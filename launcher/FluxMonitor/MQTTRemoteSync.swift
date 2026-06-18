import Foundation
import CryptoKit
import SwiftUI
import CoreImage.CIFilterBuiltins

// MARK: - MQTT Remote Sync Module
// Publishes encrypted public URLs to a public MQTT broker so that
// the Android "Flux Remote" app can discover the Mac's current address
// without any server setup.

class MQTTRemoteSync: ObservableObject {
    static let shared = MQTTRemoteSync()
    
    @Published var isConnected: Bool = false
    @Published var lastPublishTime: Date? = nil
    
    // --- Identity (persisted in UserDefaults) ---
    
    var topicID: String {
        if let id = UserDefaults.standard.string(forKey: "mqtt_topic_id"), !id.isEmpty {
            return id
        }
        let newID = generateRandomHex(length: 16)
        UserDefaults.standard.set(newID, forKey: "mqtt_topic_id")
        return newID
    }
    
    var aesKeyBase64: String {
        if let key = UserDefaults.standard.string(forKey: "mqtt_aes_key"), !key.isEmpty {
            return key
        }
        // Generate a random 256-bit key
        let key = SymmetricKey(size: .bits256)
        let keyData = key.withUnsafeBytes { Data($0) }
        let base64 = keyData.base64EncodedString()
        UserDefaults.standard.set(base64, forKey: "mqtt_aes_key")
        return base64
    }
    
    var pairingURI: String {
        let encodedKey = aesKeyBase64.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? aesKeyBase64
        return "https://chentao1006.github.io/FluxRemote/connect.html?topic=\(topicID)&key=\(encodedKey)"
    }
    
    // --- MQTT Broker Failover ---
    
    private struct MQTTBroker {
        let host: String
        let port: Int
        let path: String
        let useTLS: Bool
        
        var urlString: String {
            let scheme = useTLS ? "wss" : "ws"
            return "\(scheme)://\(host):\(port)\(path)"
        }
    }
    
    private let brokers: [MQTTBroker] = [
        MQTTBroker(host: "broker.emqx.io", port: 8084, path: "/mqtt", useTLS: true),
        MQTTBroker(host: "broker.hivemq.com", port: 8884, path: "/mqtt", useTLS: true),
    ]
    
    private var currentBrokerIndex: Int = 0
    
    // --- WebSocket / MQTT State ---
    
    private var webSocketTask: URLSessionWebSocketTask?
    private var urlSession: URLSession?
    private var keepAliveTimer: Timer?
    private var pendingPublishPayload: Data? = nil
    private var pendingURL: String? = nil
    private var connectTimeoutWorkItem: DispatchWorkItem?
    private var isConnecting: Bool = false
    
    private let mqttKeepAlive: UInt16 = 60 // seconds
    
    private init() {}
    
    deinit {
        disconnect()
    }
    
    // MARK: - Public API
    
    /// Called whenever the tunnel URL changes. Encrypts and publishes.
    func publishURL(_ url: String) {
        guard !url.isEmpty else { return }
        
        pendingURL = url
        
        let username = UserDefaults.standard.string(forKey: "username") ?? ""
        let password = UserDefaults.standard.string(forKey: "password") ?? ""
        
        let hostName = Host.current().localizedName ?? ProcessInfo.processInfo.hostName
        let payloadDict: [String: String] = [
            "url": url,
            "hostname": hostName,
            "u": username,
            "p": password
        ]
        
        let jsonData = (try? JSONSerialization.data(withJSONObject: payloadDict, options: [])) ?? Data()
        let plaintext = String(data: jsonData, encoding: .utf8) ?? url
        
        guard let encrypted = encrypt(plaintext) else {
            log("Failed to encrypt data for MQTT publish")
            return
        }
        
        pendingPublishPayload = encrypted
        
        if isConnected {
            sendPublish(payload: encrypted)
        } else if !isConnecting {
            connectToNextBroker()
        }
        // If currently connecting, the publish will fire in the CONNACK handler
    }
    
    /// Disconnect and clean up
    func disconnect() {
        keepAliveTimer?.invalidate()
        keepAliveTimer = nil
        connectTimeoutWorkItem?.cancel()
        connectTimeoutWorkItem = nil
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        urlSession?.invalidateAndCancel()
        urlSession = nil
        isConnecting = false
        DispatchQueue.main.async {
            self.isConnected = false
        }
    }
    
    // MARK: - Connection
    
    private func connectToNextBroker() {
        guard currentBrokerIndex < brokers.count else {
            currentBrokerIndex = 0
            log("All MQTT brokers failed. Will retry on next URL change.")
            isConnecting = false
            return
        }
        
        let broker = brokers[currentBrokerIndex]
        log("Connecting to MQTT broker: \(broker.host)...")
        isConnecting = true
        
        guard let url = URL(string: broker.urlString) else {
            log("Invalid broker URL: \(broker.urlString)")
            currentBrokerIndex += 1
            connectToNextBroker()
            return
        }
        
        // Clean up previous session
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        urlSession?.invalidateAndCancel()
        
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 30
        urlSession = URLSession(configuration: config)
        
        var request = URLRequest(url: url)
        request.setValue("mqtt", forHTTPHeaderField: "Sec-WebSocket-Protocol")
        
        webSocketTask = urlSession?.webSocketTask(with: request)
        webSocketTask?.resume()
        
        // Set a connect timeout
        let timeout = DispatchWorkItem { [weak self] in
            guard let self = self else { return }
            self.log("MQTT broker \(broker.host) connection timed out")
            self.webSocketTask?.cancel(with: .goingAway, reason: nil)
            self.currentBrokerIndex += 1
            self.connectToNextBroker()
        }
        connectTimeoutWorkItem = timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + 10, execute: timeout)
        
        // Send CONNECT immediately after WebSocket opens
        sendMQTTConnect()
        receiveMessage()
    }
    
    // MARK: - MQTT Protocol (Minimal 3.1.1)
    
    private func sendMQTTConnect() {
        // Build MQTT CONNECT packet
        var variableHeader = Data()
        
        // Protocol Name "MQTT"
        variableHeader.appendMQTTString("MQTT")
        // Protocol Level (4 = MQTT 3.1.1)
        variableHeader.append(4)
        // Connect Flags: Clean Session (0x02)
        variableHeader.append(0x02)
        // Keep Alive
        variableHeader.append(UInt8(mqttKeepAlive >> 8))
        variableHeader.append(UInt8(mqttKeepAlive & 0xFF))
        
        // Payload: Client ID
        let clientID = "flux_\(topicID.prefix(12))"
        var payload = Data()
        payload.appendMQTTString(clientID)
        
        let body = variableHeader + payload
        
        // Fixed header: CONNECT = 0x10
        var packet = Data()
        packet.append(0x10)
        packet.appendRemainingLength(body.count)
        packet.append(body)
        
        sendRawData(packet)
    }
    
    private func sendPublish(payload: Data) {
        let topic = "flux_remote/\(topicID)"
        
        var variableHeader = Data()
        variableHeader.appendMQTTString(topic)
        // No Packet Identifier for QoS 0
        
        let body = variableHeader + payload
        
        // Fixed header: PUBLISH = 0x30, QoS 0, Retain = 1 → 0x31
        var packet = Data()
        packet.append(0x31) // PUBLISH + Retain flag
        packet.appendRemainingLength(body.count)
        packet.append(body)
        
        sendRawData(packet) { [weak self] success in
            if success {
                DispatchQueue.main.async {
                    self?.lastPublishTime = Date()
                }
                self?.log("MQTT publish success to topic: \(topic)")
            } else {
                self?.log("MQTT publish failed. Will reconnect...")
                DispatchQueue.main.async {
                    self?.isConnected = false
                    self?.isConnecting = false
                    self?.connectToNextBroker()
                }
            }
        }
    }
    
    private func sendPingReq() {
        // PINGREQ: 0xC0 0x00
        sendRawData(Data([0xC0, 0x00]))
    }
    
    private func sendRawData(_ data: Data, completion: ((Bool) -> Void)? = nil) {
        webSocketTask?.send(.data(data)) { error in
            if let error = error {
                self.log("WebSocket send error: \(error.localizedDescription)")
                completion?(false)
            } else {
                completion?(true)
            }
        }
    }
    
    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            guard let self = self else { return }
            
            switch result {
            case .success(let message):
                switch message {
                case .data(let data):
                    self.handleMQTTPacket(data)
                case .string(_):
                    break // MQTT uses binary
                @unknown default:
                    break
                }
                // Continue receiving
                self.receiveMessage()
                
            case .failure(let error):
                self.log("WebSocket receive error: \(error.localizedDescription)")
                DispatchQueue.main.async {
                    self.isConnected = false
                    self.isConnecting = false
                }
                // Try next broker if we weren't already connected
                if !self.isConnected {
                    self.currentBrokerIndex += 1
                    self.connectToNextBroker()
                }
            }
        }
    }
    
    private func handleMQTTPacket(_ data: Data) {
        guard let firstByte = data.first else { return }
        let packetType = firstByte >> 4
        
        switch packetType {
        case 2: // CONNACK
            connectTimeoutWorkItem?.cancel()
            connectTimeoutWorkItem = nil
            
            if data.count >= 4 && data[3] == 0 {
                log("MQTT connected successfully")
                isConnecting = false
                DispatchQueue.main.async {
                    self.isConnected = true
                }
                startKeepAlive()
                // Publish pending payload if any
                if let payload = pendingPublishPayload {
                    sendPublish(payload: payload)
                }
            } else {
                let rc = data.count >= 4 ? data[3] : 0xFF
                log("MQTT CONNACK rejected, return code: \(rc)")
                currentBrokerIndex += 1
                connectToNextBroker()
            }
            
        case 13: // PINGRESP
            break // Expected
            
        default:
            break
        }
    }
    
    private func startKeepAlive() {
        keepAliveTimer?.invalidate()
        keepAliveTimer = Timer.scheduledTimer(withTimeInterval: TimeInterval(mqttKeepAlive - 5), repeats: true) { [weak self] _ in
            self?.sendPingReq()
        }
    }
    
    // MARK: - AES-GCM Encryption
    
    private func encrypt(_ plaintext: String) -> Data? {
        guard let keyData = Data(base64Encoded: aesKeyBase64) else {
            log("Invalid AES key")
            return nil
        }
        let key = SymmetricKey(data: keyData)
        
        guard let plaintextData = plaintext.data(using: .utf8) else { return nil }
        
        do {
            let sealedBox = try AES.GCM.seal(plaintextData, using: key)
            // Combine nonce + ciphertext + tag for easy decryption on the other end
            guard let combined = sealedBox.combined else { return nil }
            // Return as Base64 string data for MQTT payload
            let base64 = combined.base64EncodedString()
            return base64.data(using: .utf8)
        } catch {
            log("AES-GCM encryption failed: \(error.localizedDescription)")
            return nil
        }
    }
    
    // MARK: - QR Code Generation
    
    func generateQRCode() -> NSImage? {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()
        
        guard let data = pairingURI.data(using: .utf8) else { return nil }
        filter.setValue(data, forKey: "inputMessage")
        filter.setValue("M", forKey: "inputCorrectionLevel")
        
        guard let ciImage = filter.outputImage else { return nil }
        
        // Scale up for clarity
        let scale = CGAffineTransform(scaleX: 10, y: 10)
        let scaledImage = ciImage.transformed(by: scale)
        
        guard let cgImage = context.createCGImage(scaledImage, from: scaledImage.extent) else { return nil }
        
        let nsImage = NSImage(cgImage: cgImage, size: NSSize(width: cgImage.width, height: cgImage.height))
        return nsImage
    }
    
    // MARK: - Helpers
    
    private func generateRandomHex(length: Int) -> String {
        var bytes = [UInt8](repeating: 0, count: length)
        _ = SecRandomCopyBytes(kSecRandomDefault, length, &bytes)
        return bytes.map { String(format: "%02x", $0) }.joined()
    }
    
    private func log(_ message: String) {
        TunnelManager.shared.appendLog("[MQTT] \(message)\n")
    }
}

// MARK: - Data Extensions for MQTT Protocol Encoding

private extension Data {
    mutating func appendMQTTString(_ string: String) {
        let utf8 = string.utf8
        let length = UInt16(utf8.count)
        append(UInt8(length >> 8))
        append(UInt8(length & 0xFF))
        append(contentsOf: utf8)
    }
    
    mutating func appendRemainingLength(_ length: Int) {
        var value = length
        repeat {
            var byte = UInt8(value % 128)
            value /= 128
            if value > 0 {
                byte |= 0x80
            }
            append(byte)
        } while value > 0
    }
}

// MARK: - QR Code Popover View

struct MQTTQRCodeView: View {
    @StateObject var syncManager = MQTTRemoteSync.shared
    @StateObject var i18n = I18N.shared
    
    var body: some View {
        VStack(spacing: 16) {
            Text(i18n.t("mqtt_qr_title"))
                .font(.headline)
            
            if let qrImage = syncManager.generateQRCode() {
                Image(nsImage: qrImage)
                    .resizable()
                    .interpolation(.none)
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 200, height: 200)
                    .cornerRadius(8)
                    .shadow(color: Color.blue.opacity(0.2), radius: 8, x: 0, y: 4)
            } else {
                ProgressView()
                    .frame(width: 200, height: 200)
            }
            
            Text(i18n.t("mqtt_qr_desc"))
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 8)
            
            // Status indicators
            HStack(spacing: 6) {
                Circle()
                    .fill(syncManager.isConnected ? Color.green : Color.orange)
                    .frame(width: 8, height: 8)
                Text(syncManager.isConnected
                     ? i18n.t("mqtt_connected")
                     : i18n.t("mqtt_standby"))
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                if let lastTime = syncManager.lastPublishTime {
                    Text("·")
                        .foregroundColor(.secondary)
                    Text(i18n.t("mqtt_last_sync") + " " + formatTime(lastTime))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(20)
        .frame(width: 280)
    }
    
    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        return formatter.string(from: date)
    }
}
