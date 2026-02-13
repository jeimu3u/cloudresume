/* ===================================
   James Chambers — Cloud Resume
   Author ID: 4036
   =================================== */

(() => {
    'use strict';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ─── Particle Canvas Animation ───────────────────────────────────
    function initParticles() {
        const canvas = document.getElementById('particleCanvas');
        if (!canvas || prefersReducedMotion) return;

        const ctx = canvas.getContext('2d');
        let particles = [];
        let animationId;
        let width, height;

        // Mouse tracking
        const mouse = { x: null, y: null, radius: 250, clicking: false };
        const hero = canvas.parentElement;

        hero.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
        });

        hero.addEventListener('mouseleave', () => {
            mouse.x = null;
            mouse.y = null;
        });

        hero.addEventListener('mousedown', () => { mouse.clicking = true; });
        hero.addEventListener('mouseup', () => { mouse.clicking = false; });

        function resize() {
            width = canvas.width = canvas.offsetWidth;
            height = canvas.height = canvas.offsetHeight;
        }

        function createParticles() {
            const count = Math.min(Math.floor((width * height) / 10000), 120);
            particles = [];
            for (let i = 0; i < count; i++) {
                const bvx = (Math.random() - 0.5) * 0.6;
                const bvy = (Math.random() - 0.5) * 0.6;
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    baseVx: bvx,
                    baseVy: bvy,
                    boostVx: 0,
                    boostVy: 0,
                    baseR: Math.random() * 2 + 1,
                    r: Math.random() * 2 + 1,
                    baseOpacity: Math.random() * 0.4 + 0.2,
                    opacity: Math.random() * 0.4 + 0.2,
                });
            }
        }

        function draw() {
            ctx.clearRect(0, 0, width, height);

            const mouseActive = mouse.x !== null && mouse.y !== null;

            // Draw glowing cursor halo
            if (mouseActive) {
                const gradient = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, mouse.radius);
                gradient.addColorStop(0, 'rgba(0, 119, 204, 0.08)');
                gradient.addColorStop(0.5, 'rgba(0, 119, 204, 0.03)');
                gradient.addColorStop(1, 'rgba(0, 119, 204, 0)');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, width, height);
            }

            // Draw connections between particles
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 150) {
                        const alpha = 0.15 * (1 - dist / 150);
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(0, 119, 204, ${alpha})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }

            // Draw bright connections from mouse to nearby particles
            if (mouseActive) {
                for (const p of particles) {
                    const dx = mouse.x - p.x;
                    const dy = mouse.y - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < mouse.radius) {
                        const proximity = 1 - dist / mouse.radius;
                        const alpha = 0.5 * proximity;
                        const lineW = 0.5 + 2 * proximity;
                        ctx.beginPath();
                        ctx.moveTo(mouse.x, mouse.y);
                        ctx.lineTo(p.x, p.y);
                        ctx.strokeStyle = `rgba(51, 180, 255, ${alpha})`;
                        ctx.lineWidth = lineW;
                        ctx.stroke();
                    }
                }

                // Draw cursor dot
                ctx.beginPath();
                ctx.arc(mouse.x, mouse.y, 3, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(51, 180, 255, 0.8)';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(mouse.x, mouse.y, 6, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(51, 180, 255, 0.3)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // Draw particles — glow bigger/brighter near mouse
            for (const p of particles) {
                // Glow effect for particles near mouse
                if (mouseActive) {
                    const dx = mouse.x - p.x;
                    const dy = mouse.y - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < mouse.radius) {
                        const proximity = 1 - dist / mouse.radius;
                        p.r = p.baseR + 3 * proximity;
                        p.opacity = Math.min(1, p.baseOpacity + 0.6 * proximity);

                        // Outer glow on close particles
                        if (proximity > 0.4) {
                            ctx.beginPath();
                            ctx.arc(p.x, p.y, p.r + 4, 0, Math.PI * 2);
                            ctx.fillStyle = `rgba(51, 180, 255, ${0.12 * proximity})`;
                            ctx.fill();
                        }
                    } else {
                        p.r = p.baseR;
                        p.opacity = p.baseOpacity;
                    }
                } else {
                    p.r = p.baseR;
                    p.opacity = p.baseOpacity;
                }

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(0, 150, 255, ${p.opacity})`;
                ctx.fill();
            }
        }

        function update() {
            for (const p of particles) {
                if (mouse.x !== null && mouse.y !== null) {
                    const dx = mouse.x - p.x;
                    const dy = mouse.y - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < mouse.radius && dist > 3) {
                        const proximity = 1 - dist / mouse.radius;

                        if (mouse.clicking) {
                            // Click = REPEL — explosive push away
                            const force = 0.4 * proximity;
                            p.boostVx -= dx / dist * force;
                            p.boostVy -= dy / dist * force;
                        } else {
                            // Hover = ATTRACT — pull toward cursor
                            const force = 0.08 * proximity;
                            p.boostVx += dx / dist * force;
                            p.boostVy += dy / dist * force;
                        }
                    }
                }

                // Dampen only the boost
                p.boostVx *= 0.94;
                p.boostVy *= 0.94;

                // Clamp boost speed
                const boostSpeed = Math.sqrt(p.boostVx * p.boostVx + p.boostVy * p.boostVy);
                if (boostSpeed > 4) {
                    p.boostVx = (p.boostVx / boostSpeed) * 4;
                    p.boostVy = (p.boostVy / boostSpeed) * 4;
                }

                // Move
                p.x += p.baseVx + p.boostVx;
                p.y += p.baseVy + p.boostVy;

                // Bounce off edges
                if (p.x < 0 || p.x > width) p.baseVx *= -1;
                if (p.y < 0 || p.y > height) p.baseVy *= -1;
                p.x = Math.max(0, Math.min(width, p.x));
                p.y = Math.max(0, Math.min(height, p.y));
            }
        }

        function animate() {
            update();
            draw();
            animationId = requestAnimationFrame(animate);
        }

        // Pause when tab not visible for performance
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                cancelAnimationFrame(animationId);
            } else {
                animate();
            }
        });

        window.addEventListener('resize', () => {
            resize();
            createParticles();
        });

        resize();
        createParticles();
        animate();
    }

    // ─── Typing Effect ───────────────────────────────────────────────
    function initTypingEffect() {
        const el = document.getElementById('typingText');
        if (!el) return;

        const phrases = [
            'Bringing Law & Order to the Cloud',
            'Azure & AWS Infrastructure',
            'Infrastructure as Code',
            'Kubernetes & Containerisation',
            'CI/CD Pipelines',
            'Scrum Master & Agile',
            'DevOps Automation',
        ];

        let phraseIndex = 0;
        let charIndex = 0;
        let isDeleting = false;

        function type() {
            const current = phrases[phraseIndex];

            if (isDeleting) {
                el.textContent = current.substring(0, charIndex - 1);
                charIndex--;
            } else {
                el.textContent = current.substring(0, charIndex + 1);
                charIndex++;
            }

            let delay = isDeleting ? 30 : 60;

            if (!isDeleting && charIndex === current.length) {
                delay = 2000; // Pause at full phrase
                isDeleting = true;
            } else if (isDeleting && charIndex === 0) {
                isDeleting = false;
                phraseIndex = (phraseIndex + 1) % phrases.length;
                delay = 500;
            }

            setTimeout(type, delay);
        }

        if (prefersReducedMotion) {
            el.textContent = phrases[0];
        } else {
            type();
        }
    }

    // ─── Sticky Navbar ───────────────────────────────────────────────
    function initNavbar() {
        const navbar = document.getElementById('navbar');
        const hero = document.getElementById('hero');
        if (!navbar || !hero) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                navbar.classList.toggle('visible', !entry.isIntersecting);
            },
            { threshold: 0, rootMargin: '-60px 0px 0px 0px' }
        );

        observer.observe(hero);
    }

    // ─── Active Nav Link Tracking ────────────────────────────────────
    function initActiveNav() {
        const sections = document.querySelectorAll('section[id]');
        const navLinks = document.querySelectorAll('.nav-link');
        if (!sections.length || !navLinks.length) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        navLinks.forEach((link) => {
                            link.classList.toggle(
                                'active',
                                link.getAttribute('href') === `#${entry.target.id}`
                            );
                        });
                    }
                });
            },
            { threshold: 0.3, rootMargin: '-70px 0px -40% 0px' }
        );

        sections.forEach((section) => observer.observe(section));
    }

    // ─── Mobile Nav Toggle ───────────────────────────────────────────
    function initMobileNav() {
        const toggle = document.getElementById('navToggle');
        const links = document.getElementById('navLinks');
        if (!toggle || !links) return;

        toggle.addEventListener('click', () => {
            toggle.classList.toggle('open');
            links.classList.toggle('open');
        });

        // Close on link click
        links.querySelectorAll('.nav-link').forEach((link) => {
            link.addEventListener('click', () => {
                toggle.classList.remove('open');
                links.classList.remove('open');
            });
        });
    }

    // ─── Scroll-Triggered Animations ─────────────────────────────────
    function initScrollAnimations() {
        const elements = document.querySelectorAll('.animate-on-scroll');
        if (!elements.length) return;

        if (prefersReducedMotion) {
            elements.forEach((el) => el.classList.add('visible'));
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
        );

        elements.forEach((el) => observer.observe(el));
    }

    // ─── Skill Bar Animation ─────────────────────────────────────────
    function initSkillBars() {
        const bars = document.querySelectorAll('.skill-fill');
        if (!bars.length) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const width = entry.target.getAttribute('data-width');
                        entry.target.style.width = width + '%';
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.3 }
        );

        bars.forEach((bar) => observer.observe(bar));
    }

    // ─── Timeline Accordion ──────────────────────────────────────────
    function initTimeline() {
        const headers = document.querySelectorAll('.timeline-header');

        headers.forEach((header) => {
            header.addEventListener('click', () => {
                const details = header.nextElementSibling;
                const isOpen = details.classList.contains('open');

                // Close all open items
                document.querySelectorAll('.timeline-details.open').forEach((d) => {
                    d.classList.remove('open');
                    d.previousElementSibling.setAttribute('aria-expanded', 'false');
                });

                // Toggle clicked item
                if (!isOpen) {
                    details.classList.add('open');
                    header.setAttribute('aria-expanded', 'true');
                }
            });

            // Keyboard support
            header.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    header.click();
                }
            });
        });

        // All cards start closed
    }

    // ─── Visitor Counter with Count-Up Animation ─────────────────────
    function initVisitorCounter() {
        const el = document.getElementById('visitorCount');
        if (!el) return;

        fetch('https://visitorcounterfa.azurewebsites.net/api/visitorCounter')
            .then((res) => {
                if (!res.ok) throw new Error('Network response was not ok');
                return res.json();
            })
            .then((data) => {
                if (typeof data.count !== 'number') {
                    throw new Error('Invalid count');
                }

                const target = data.count;

                if (prefersReducedMotion) {
                    el.innerHTML = `<i class="fas fa-eye"></i> Visitors: ${target.toLocaleString()}`;
                    return;
                }

                // Count-up animation triggered when footer scrolls into view
                const footer = document.getElementById('footer');
                const observer = new IntersectionObserver(
                    ([entry]) => {
                        if (entry.isIntersecting) {
                            animateCount(el, target);
                            observer.disconnect();
                        }
                    },
                    { threshold: 0.5 }
                );

                if (footer) {
                    observer.observe(footer);
                } else {
                    el.innerHTML = `<i class="fas fa-eye"></i> Visitors: ${target.toLocaleString()}`;
                }
            })
            .catch((err) => {
                console.error('Visitor counter error:', err);
                el.innerHTML = '<i class="fas fa-eye"></i> Visitor count unavailable';
            });
    }

    function animateCount(el, target) {
        const duration = 2000;
        const start = performance.now();

        function step(timestamp) {
            const progress = Math.min((timestamp - start) / duration, 1);
            // Ease-out cubic for a satisfying deceleration
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.floor(eased * target);
            el.innerHTML = `<i class="fas fa-eye"></i> Visitors: ${current.toLocaleString()}`;

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                el.innerHTML = `<i class="fas fa-eye"></i> Visitors: ${target.toLocaleString()}`;
            }
        }

        requestAnimationFrame(step);
    }

    // ─── Lightbox Keyboard Close ─────────────────────────────────────
    function initLightbox() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && window.location.hash.includes('lightbox')) {
                window.location.hash = '#certifications';
            }
        });
    }

    // ─── Init Everything on DOM Ready ────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('currentYear').textContent = new Date().getFullYear();
        initParticles();
        initTypingEffect();
        initNavbar();
        initActiveNav();
        initMobileNav();
        initScrollAnimations();
        initSkillBars();
        initTimeline();
        initVisitorCounter();
        initLightbox();
    });
})();
