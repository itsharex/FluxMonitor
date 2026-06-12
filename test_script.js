        const track = document.getElementById('carousel-track');
        if (track) {
            const slides = Array.from(track.children);
            const indicators = document.getElementById('carousel-indicators');
            let currentSlide = 0;
            let carouselInterval;

            slides.forEach((_, index) => {
                const dot = document.createElement('div');
                dot.classList.add('carousel-dot');
                if (index === 0) dot.classList.add('active');
                dot.addEventListener('click', () => {
                    goToSlide(index);
                    resetInterval();
                });
                indicators.appendChild(dot);
            });

            const dots = Array.from(indicators.children);

            function goToSlide(index) {
                track.scrollLeft = index * track.offsetWidth;
                if (dots[currentSlide]) dots[currentSlide].classList.remove('active');
                if (dots[index]) dots[index].classList.add('active');
                currentSlide = index;
            }

            track.addEventListener('scroll', () => {
                if (!track.offsetWidth) return;
                const index = Math.round(track.scrollLeft / track.offsetWidth);
                if (index !== currentSlide && index >= 0 && index < slides.length) {
                    if (dots[currentSlide]) dots[currentSlide].classList.remove('active');
                    if (dots[index]) dots[index].classList.add('active');
                    currentSlide = index;
                }
            });

            function nextSlide() {
                let nextIndex = (currentSlide + 1) % slides.length;
                goToSlide(nextIndex);
            }

            function resetInterval() {
                clearInterval(carouselInterval);
                carouselInterval = setInterval(nextSlide, 3500);
            }

            track.addEventListener('mouseenter', () => clearInterval(carouselInterval));
            track.addEventListener('mouseleave', resetInterval);
            track.addEventListener('touchstart', () => clearInterval(carouselInterval), {passive: true});
            track.addEventListener('touchend', resetInterval, {passive: true});

            resetInterval();
        }
