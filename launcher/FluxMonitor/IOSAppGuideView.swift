import SwiftUI

struct AppGuideView: View {
    @StateObject var i18n = I18N.shared
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        VStack(spacing: 20) {
            // Header with dismiss button
            HStack {
                Spacer()
                Button(action: { dismiss() }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title2)
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding([.top, .trailing], 15)
            
            // Title and Description
            VStack(spacing: 8) {
                Text(i18n.t("client_app_title"))
                    .font(.title2.bold())
                
                Text(i18n.t("client_app_desc"))
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }
            
            HStack(alignment: .top, spacing: 30) {
                // iOS Column
                VStack(spacing: 15) {
                    Text("iOS")
                        .font(.headline)
                    
                    VStack(spacing: 10) {
                        Image("QRCode")
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(width: 140, height: 140)
                            .cornerRadius(12)
                            .shadow(color: Color.blue.opacity(0.3), radius: 10, x: 0, y: 5)
                        
                        Text(i18n.t("scan_to_remote"))
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    Link(destination: URL(string: "https://apps.apple.com/app/flux-remote/id6761290185")!) {
                        Image(i18n.t("app_store_badge"))
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(height: 40)
                    }
                    .buttonStyle(.plain)
                }
                .frame(maxWidth: .infinity)
                
                Divider()
                
                // Android Column
                VStack(spacing: 15) {
                    Text("Android")
                        .font(.headline)
                    
                    VStack(spacing: 10) {
                        Image("AndroidQRCode")
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(width: 140, height: 140)
                            .cornerRadius(12)
                            .shadow(color: Color.blue.opacity(0.3), radius: 10, x: 0, y: 5)
                        
                        Text(i18n.t("scan_to_remote"))
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    Link(destination: URL(string: "https://play.google.com/store/apps/details?id=com.ct106.flux_remote")!) {
                        Image("PlayStoreBadge")
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(height: 40)
                    }
                    .buttonStyle(.plain)
                }
                .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 20)
            
            Spacer()
            
            Button(action: { dismiss() }) {
                Text(i18n.t("dismiss"))
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Color.secondary.opacity(0.1))
                    .cornerRadius(8)
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 20)
            .padding(.bottom, 20)
        }
        .frame(width: 550, height: 450)
    }
}
