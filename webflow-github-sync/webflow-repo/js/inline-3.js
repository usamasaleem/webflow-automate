pageFunctions.addFunction("globalAnimation", function () {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // --- STANDARD COMPONENT ANIMATIONS ---
    const animatedElements = document.querySelectorAll("[data-animation-gsap]");
    ScrollTrigger.refresh();
    if (animatedElements.length > 0) {
        animatedElements.forEach(function (element) {
            if (prefersReducedMotion) {
                gsap.set(element, { visibility: "visible" });
                if (element.getAttribute("data-animation-gsap") === "stagger-children") {
                    gsap.set(element.children, { visibility: "visible" });
                }
                return;
            }

            const animationType = element.getAttribute("data-animation-gsap");
            const delay = parseFloat(element.getAttribute("data-delay-gsap") || 0.1);
            const duration = parseFloat(element.getAttribute("data-duration-gsap") || 0.8);
            const timeline = gsap.timeline({ paused: true });

            // Always set visibility first
            timeline.set(element, { visibility: "visible" });

            switch (animationType) {
                case "fade-in":
                    timeline.from(element, { opacity: 0, duration, delay, ease: "power1.in" });
                    break;
                case "fade-in-up":
                    timeline.from(element, { opacity: 0, y: "1rem", duration, delay, ease: "power1.in" });
                    break;
                case "fade-in-blur":
                    timeline.from(element, { opacity: 0, filter: "blur(5px)", duration, delay, ease: "power1.in" });
                    break;
                case "scale-in":
                    timeline.from(element, { opacity: 0, scale: 0, duration, delay, ease: "power1.out" });
                    break;
                case "scale-out":
                    timeline.from(element, { scale: 1.2, duration, delay, ease: "power1.out" });
                    break;
                case "line-vertical":
                    timeline.from(element, { height: "0%", duration, delay, ease: "power1.out" });
                    break;
                case "stagger-children":
                    timeline.from(element.children, { opacity: 0, duration, stagger: 0.2, delay, ease: "power1.in" });
                    break;
                case "border-width":
                    timeline.fromTo(element,
                        { width: "0%" },
                        { width: "100%", duration, delay, ease: "power1.inOut" }
                    );
                    break;
                case "border-height":
                    timeline.fromTo(element,
                        { height: "0%" },
                        { height: "calc(100%)", duration, delay, ease: "power1.inOut" }
                    );
                    break;
                case "waterfall":
                    timeline.fromTo(element,
                        { height: "0%", overflow: "hidden" },
                        { height: "100%", duration, delay, ease: "power1.out" }
                    );
                    break;
                case "path":
                    const paths = element.querySelectorAll("path");
                    if (paths.length > 0) {
                        paths.forEach(path => {
                            const pathLength = path.getTotalLength();
                            gsap.set(path, {
                                strokeDasharray: pathLength,
                                strokeDashoffset: pathLength,
                            });
                            timeline.to(path, {
                                strokeDashoffset: 0,
                                duration: duration * 2.5,
                                ease: "power1.inOut"
                            }, `-=${duration}`);
                        });
                    }
                    break;
                default:
                    return;
            }

            ScrollTrigger.create({
                trigger: element,
                start: "top 90%",
                toggleActions: "play none none none",
                animation: timeline,
            });
        });
    }

    // --- ADVANCED TEXT ANIMATION ('words') ---
    const textAnimationTargets = document.querySelectorAll("[data-split-gsap='words']");

    textAnimationTargets.forEach((target) => {
        if (prefersReducedMotion) {
            gsap.set(target, { visibility: "visible" });
            return;
        }

        let elementsToSplit = gsap.utils.toArray(target.querySelectorAll('p, h1, h2, h3, h4, h5, h6'));
        if (elementsToSplit.length === 0) {
            elementsToSplit.push(target);
        }

        gsap.set(target, { visibility: "visible" });

        elementsToSplit.forEach((textElement) => {
            const split = new SplitText(textElement, {
                type: "lines,words",
                linesClass: "line",
                wordsClass: "word"
            });

            const tl = gsap.timeline({ paused: true });

            split.lines.forEach((line, lineIndex) => {
                const words = line.querySelectorAll(".word");
                tl.from(words, {
                    opacity: 0,
                    filter: "blur(5px)",
                    duration: 1,
                    stagger: 0.05,
                }, lineIndex * 0.2);
            });

            ScrollTrigger.create({
                trigger: textElement,
                start: "top 90%",
                end: "top bottom",
                toggleActions: "play none play reverse",
                animation: tl,
            });
        });
    });

    // --- ADVANCED TEXT ANIMATION ('subtitle' by characters) ---
    const subtitleTargets = document.querySelectorAll("[data-split-text='subtitle']");

    subtitleTargets.forEach((target) => {
        if (prefersReducedMotion) {
            gsap.set(target, { visibility: "visible" });
            return;
        }

        let elementsToSplit = gsap.utils.toArray(target.querySelectorAll('p, h1, h2, h3, h4, h5, h6'));
        if (elementsToSplit.length === 0) {
            elementsToSplit.push(target);
        }

        gsap.set(target, { visibility: "visible" });

        elementsToSplit.forEach((textElement) => {
            const split = new SplitText(textElement, {
                type: "chars",
                charsClass: "char"
            });

            const tl = gsap.timeline({ paused: true });

            tl.from(split.chars, {
                opacity: 0,
                duration: 1.2,
                ease: "power3.out",
                stagger: 0.03
            });

            ScrollTrigger.create({
                trigger: textElement,
                start: "top 90%",
                toggleActions: "play none none none",
                animation: tl
            });
        });
    });

});