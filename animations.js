function initAnimations() {
    if (typeof gsap !== 'undefined') {
        // Kill any existing/stale tweens on re-entry
        gsap.killTweensOf(".rw-navbar, .hero-copy-wrapper > *, .rw-hero-img-container, .rw-floating-badge, .rw-card, .rw-auth-card, .rw-form-card");

        // Navbar entrance
        gsap.from(".rw-navbar", {
            y: -30,
            opacity: 0,
            duration: 0.6,
            ease: "power2.out",
            clearProps: "all"
        });

        // Homepage Hero Animations
        if (document.querySelector(".rw-hero-img-container")) {
            const heroTl = gsap.timeline();

            heroTl.from(".hero-copy-wrapper > *", {
                y: 30,
                opacity: 0,
                duration: 0.7,
                stagger: 0.1,
                ease: "power3.out",
                clearProps: "all"
            })
            .from(".rw-hero-img-container", {
                scale: 0.9,
                opacity: 0,
                duration: 1,
                ease: "power3.out",
                clearProps: "transform,opacity"
            }, "-=0.5")
            .from(".rw-floating-badge", {
                x: -30,
                opacity: 0,
                duration: 0.6,
                ease: "back.out(1.7)",
                clearProps: "transform,opacity"
            }, "-=0.3");

            // Interactive Mouse Tilt on Hero Image Card
            const heroCard = document.querySelector(".hero-img-card");
            const heroContainer = document.querySelector(".rw-hero-img-container");

            if (heroCard && heroContainer) {
                heroContainer.onmousemove = (e) => {
                    const rect = heroContainer.getBoundingClientRect();
                    const x = e.clientX - rect.left - rect.width / 2;
                    const y = e.clientY - rect.top - rect.height / 2;
                    
                    gsap.to(heroCard, {
                        rotationY: x * 0.04,
                        rotationX: -y * 0.04,
                        transformPerspective: 1000,
                        ease: "power1.out",
                        duration: 0.5
                    });
                };

                heroContainer.onmouseleave = () => {
                    gsap.to(heroCard, {
                        rotationY: 0,
                        rotationX: 0,
                        ease: "power2.out",
                        duration: 0.8
                    });
                };
            }
        }

        // Cards stagger animation with clearProps to avoid opacity bugs
        if (document.querySelector(".rw-card")) {
            gsap.from(".rw-card", {
                y: 20,
                opacity: 0,
                duration: 0.5,
                stagger: 0.05,
                ease: "power2.out",
                clearProps: "all"
            });
        }

        // Auth & Form card entrance
        if (document.querySelector(".rw-auth-card, .rw-form-card")) {
            gsap.from(".rw-auth-card, .rw-form-card", {
                y: 20,
                opacity: 0,
                duration: 0.6,
                ease: "power2.out",
                clearProps: "all"
            });
        }
    }
}

document.addEventListener("DOMContentLoaded", initAnimations);

// Handle back/forward navigation (bfcache)
window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
        initAnimations();
    }
});

