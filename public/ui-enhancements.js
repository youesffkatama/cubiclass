/**
 * Modern UI Enhancements for Scholar.AI
 * Adds advanced animations, micro-interactions, and visual polish
 */

class ModernUI {
  constructor() {
    this.init();
  }

  init() {
    this.addSmoothScrolling();
    this.addIntersectionObserver();
    this.addHoverEffects();
    this.addFocusIndicators();
    this.addLoadingStates();
    this.addProgressiveEnhancement();
  }

  addSmoothScrolling() {
    // Add smooth scrolling to anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });
  }

  addIntersectionObserver() {
    // Add intersection observer for scroll animations
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
            
            // Add staggered animations
            const elements = entry.target.querySelectorAll('[data-animate]');
            elements.forEach((el, index) => {
              setTimeout(() => {
                el.classList.add('animate-fade-in');
              }, index * 100);
            });
          }
        });
      }, {
        threshold: 0.1
      });

      // Observe elements with animate-on-scroll class
      document.querySelectorAll('.animate-on-scroll').forEach(el => {
        observer.observe(el);
      });
    }
  }

  addHoverEffects() {
    // Add subtle hover effects to interactive elements
    document.querySelectorAll('button, .btn, .nav-link, .card, .feature-card').forEach(el => {
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'translateY(-2px)';
        el.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
        el.style.boxShadow = '0 10px 25px rgba(0, 237, 100, 0.15)';
      });

      el.addEventListener('mouseleave', () => {
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
      });
    });
  }

  addFocusIndicators() {
    // Add focus indicators for accessibility
    document.querySelectorAll('button, input, textarea, select, a').forEach(el => {
      el.addEventListener('focus', () => {
        el.style.outline = '2px solid var(--primary, #00ed64)';
        el.style.outlineOffset = '2px';
      });

      el.addEventListener('blur', () => {
        el.style.outline = 'none';
      });
    });
  }

  addLoadingStates() {
    // Add loading states to buttons
    document.querySelectorAll('button[type="submit"], .btn-loading').forEach(btn => {
      btn.addEventListener('click', function() {
        const originalHTML = this.innerHTML;
        const originalDisabled = this.disabled;
        
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        this.disabled = true;
        
        // Reset after 2 seconds (or when form submission completes)
        setTimeout(() => {
          if (this.disabled) {
            this.innerHTML = originalHTML;
            this.disabled = originalDisabled;
          }
        }, 2000);
      });
    });
  }

  addProgressiveEnhancement() {
    // Add progressive enhancement for older browsers
    if (!window.IntersectionObserver) {
      // Fallback for browsers that don't support Intersection Observer
      document.querySelectorAll('.animate-on-scroll').forEach(el => {
        el.classList.add('animate-in');
      });
    }

    // Add backdrop-filter support detection
    if (CSS.supports('backdrop-filter', 'blur(10px)')) {
      document.documentElement.style.setProperty('--backdrop-blur', 'blur(10px)');
    } else {
      document.documentElement.style.setProperty('--backdrop-blur', 'none');
    }
  }

  // Add parallax effect
  addParallax() {
    window.addEventListener('scroll', () => {
      const scrolled = window.pageYOffset;
      const parallaxElements = document.querySelectorAll('.parallax');
      
      parallaxElements.forEach(el => {
        const speed = parseFloat(el.getAttribute('data-parallax-speed')) || 0.5;
        const yPos = -(scrolled * speed);
        el.style.transform = `translateY(${yPos}px)`;
      });
    });
  }

  // Add scroll progress indicator
  addScrollProgress() {
    const progress = document.createElement('div');
    progress.id = 'scroll-progress';
    progress.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 0%;
      height: 3px;
      background: linear-gradient(90deg, transparent, var(--primary, #00ed64));
      z-index: 9999;
      transition: width 0.1s ease;
    `;
    document.body.appendChild(progress);

    window.addEventListener('scroll', () => {
      const scrollTop = window.pageYOffset;
      const docHeight = document.body.offsetHeight - window.innerHeight;
      const scrollPercent = scrollTop / docHeight * 100;
      progress.style.width = `${Math.min(scrollPercent, 100)}%`;
    });
  }

  // Add floating action button
  addFloatingActionButton() {
    const fab = document.createElement('div');
    fab.id = 'fab';
    fab.innerHTML = '<i class="fas fa-plus"></i>';
    fab.style.cssText = `
      position: fixed;
      bottom: 30px;
      right: 30px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: var(--primary, #00ed64);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0, 237, 100, 0.3);
      z-index: 1000;
      transition: all 0.3s ease;
    `;
    
    fab.addEventListener('click', () => {
      // Add custom action here
      window.Utils.showToast('Floating action triggered', 'info');
    });
    
    document.body.appendChild(fab);
  }
}

// Initialize modern UI enhancements when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.ModernUI = new ModernUI();
  
  // Add additional enhancements
  window.ModernUI.addParallax();
  window.ModernUI.addScrollProgress();
  window.ModernUI.addFloatingActionButton();
});

// Export for external use
window.ModernUI = window.ModernUI || null;