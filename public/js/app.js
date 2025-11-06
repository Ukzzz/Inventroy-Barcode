// ==========================================================
// Uniform Inventory System - Main JavaScript File
// Optimized for Performance & User Experience
// ==========================================================

const App = {
    // Cache for DOM queries
    cache: {},
    
    // -----------------------------
    // Initialize the application
    // -----------------------------
    init() {
        // Performance optimization: Use requestAnimationFrame for non-critical tasks
        requestAnimationFrame(() => {
            this.setupEventListeners();
            this.setupLazyLoading();
            this.setupFormValidation();
            this.setupBarcodePreview();
            this.setupIntersectionObserver();
            console.log('✅ Inventory System initialized - Performance Optimized');
        });
    },

    // -----------------------------
    // Setup global event listeners
    // -----------------------------
    setupEventListeners() {
        this.autoHideFlashMessages();
        this.setupMobileMenu();
        this.setupUserDropdown();
        this.setupConfirmationDialogs();
        this.setupSmoothScroll();
        this.setupKeyboardShortcuts();
    },

    // -----------------------------
    // Auto-hide flash messages with animation
    // -----------------------------
    autoHideFlashMessages() {
        const flashMessages = document.querySelectorAll('[role="alert"], .alert-message');
        flashMessages.forEach((msg, index) => {
            // Stagger animations for multiple messages
            setTimeout(() => {
                msg.style.animation = 'fadeIn 0.3s ease-in';
                setTimeout(() => {
                    msg.style.animation = 'fadeOut 0.3s ease-out';
                    setTimeout(() => msg.remove(), 300);
                }, 5000);
            }, index * 100);
        });
    },

    // -----------------------------
    // Lazy Loading for Images
    // -----------------------------
    setupLazyLoading() {
        const lazyImages = document.querySelectorAll('img[data-src]');
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.add('fade-in');
                        imageObserver.unobserve(img);
                    }
                });
            });
            lazyImages.forEach(img => imageObserver.observe(img));
        }
    },

    // -----------------------------
    // Intersection Observer for Animations
    // -----------------------------
    setupIntersectionObserver() {
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('fade-in');
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1 });

            document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
        }
    },

    // -----------------------------
    // Mobile Menu Toggle
    // -----------------------------
    setupMobileMenu() {
        const button = document.querySelector('.md\\:hidden button');
        const menu = document.getElementById('mobile-menu');
        if (button && menu) {
            button.addEventListener('click', () => menu.classList.toggle('hidden'));
        }
    },

    // -----------------------------
    // User Dropdown Menu
    // -----------------------------
    setupUserDropdown() {
        const userMenuButton = document.getElementById('user-menu-button');
        const userMenuDropdown = document.getElementById('user-menu-dropdown');
        
        if (userMenuButton && userMenuDropdown) {
            userMenuButton.addEventListener('click', (e) => {
                e.stopPropagation();
                userMenuDropdown.classList.toggle('hidden');
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', (event) => {
                const userMenu = document.getElementById('user-menu');
                if (userMenu && !userMenu.contains(event.target)) {
                    userMenuDropdown.classList.add('hidden');
                }
            });
        }
    },

    // -----------------------------
    // Confirmation Dialogs (e.g., Delete)
    // -----------------------------
    setupConfirmationDialogs() {
        const deleteForms = document.querySelectorAll('form[onsubmit*="confirm"]');
        deleteForms.forEach(form => {
            form.addEventListener('submit', (e) => {
                const message = form.getAttribute('onsubmit').match(/confirm\('([^']+)'\)/);
                if (message && !confirm(message[1])) e.preventDefault();
            });
        });
    },

    // -----------------------------
    // Simple Tooltip Implementation
    // -----------------------------
    setupTooltips() {
        const tooltips = document.querySelectorAll('[title]');
        tooltips.forEach(el => {
            el.addEventListener('mouseenter', function() {
                const title = this.getAttribute('title');
                if (title) {
                    this.setAttribute('data-original-title', title);
                    this.removeAttribute('title');
                }
            });
            el.addEventListener('mouseleave', function() {
                const original = this.getAttribute('data-original-title');
                if (original) {
                    this.setAttribute('title', original);
                }
            });
        });
    },

    // -----------------------------
    // Form Validation
    // -----------------------------
    setupFormValidation() {
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
            inputs.forEach(input => {
                input.addEventListener('blur', () => this.validateField(input));
                input.addEventListener('input', () => {
                    if (input.classList.contains('border-red-500')) this.validateField(input);
                });
            });
            form.addEventListener('submit', (e) => {
                let valid = true;
                inputs.forEach(input => {
                    if (!this.validateField(input)) valid = false;
                });
                if (!valid) {
                    e.preventDefault();
                    const firstInvalid = form.querySelector('.border-red-500');
                    if (firstInvalid) firstInvalid.focus();
                    this.showMessage('Please fill in all required fields.', 'error');
                }
            });
        });
    },

    // Validate individual input field
    validateField(field) {
        const isValid = field.value.trim().length > 0;
        field.classList.toggle('border-red-500', !isValid);
        field.classList.toggle('border-gray-300', isValid);
        return isValid;
    },

    // -----------------------------
    // Barcode Preview (Optional)
    // -----------------------------
    setupBarcodePreview() {
        const input = document.getElementById('itemName');
        const preview = document.querySelector('.w-32.h-12');
        if (input && preview && window.JsBarcode) {
            input.addEventListener('input', () => {
                const value = input.value.trim() || 'Sample';
                preview.innerHTML = '';
                const canvas = document.createElement('canvas');
                JsBarcode(canvas, value, { format: 'CODE128', width: 2, height: 40, displayValue: false });
                preview.appendChild(canvas);
            });
        }
    },

    // -----------------------------
    // User Notifications
    // -----------------------------
    showMessage(message, type = 'info') {
        const msg = document.createElement('div');
        msg.className = `fixed top-4 right-4 p-4 rounded-md shadow-lg z-50 transition-opacity duration-300 ${this.getMessageClass(type)}`;
        msg.textContent = message;
        document.body.appendChild(msg);
        setTimeout(() => {
            msg.style.opacity = '0';
            setTimeout(() => msg.remove(), 300);
        }, 3000);
    },

    getMessageClass(type) {
        return {
            success: 'bg-green-100 border border-green-400 text-green-700',
            error: 'bg-red-100 border border-red-400 text-red-700',
            info: 'bg-blue-100 border border-blue-400 text-blue-700',
            warning: 'bg-yellow-100 border border-yellow-400 text-yellow-700'
        }[type] || 'bg-gray-100 border border-gray-400 text-gray-700';
    },

    // -----------------------------
    // Smooth Scroll
    // -----------------------------
    setupSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                const href = this.getAttribute('href');
                if (href !== '#' && href !== '') {
                    e.preventDefault();
                    const target = document.querySelector(href);
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            });
        });
    },

    // -----------------------------
    // Keyboard Shortcuts
    // -----------------------------
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K: Focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const searchInput = document.querySelector('input[type="search"], input[name="search"]');
                if (searchInput) searchInput.focus();
            }
            // Esc: Close modals
            if (e.key === 'Escape') {
                document.querySelectorAll('.fixed.inset-0:not(.hidden)').forEach(modal => {
                    modal.classList.add('hidden');
                });
            }
        });
    },

    // -----------------------------
    // Utility Helpers
    // -----------------------------
    utils: {
        formatCurrency(amount) {
            if (amount == null || isNaN(amount)) return 'Rs 0.00';
            return 'Rs ' + parseFloat(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        },
        formatDate(date) {
            return new Date(date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        },
        formatDateTime(date) {
            return new Date(date).toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        },
        debounce(func, wait = 300) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },
        throttle(func, limit = 300) {
            let inThrottle;
            return function (...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        },
        copyToClipboard(text) {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text)
                    .then(() => App.showMessage('✓ Copied to clipboard', 'success'))
                    .catch(() => App.showMessage('✗ Failed to copy', 'error'));
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    App.showMessage('✓ Copied to clipboard', 'success');
                } catch (err) {
                    App.showMessage('✗ Failed to copy', 'error');
                }
                document.body.removeChild(textArea);
            }
        },
        // Performance: Request Idle Callback wrapper
        runWhenIdle(callback) {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(callback);
            } else {
                setTimeout(callback, 1);
            }
        },
        // Get cached DOM element
        getElement(selector) {
            if (!App.cache[selector]) {
                App.cache[selector] = document.querySelector(selector);
            }
            return App.cache[selector];
        }
    }
};

// -----------------------------
// Performance: Passive Event Listeners
// -----------------------------
const supportsPassive = (() => {
    let passive = false;
    try {
        const opts = Object.defineProperty({}, 'passive', {
            get: () => { passive = true; }
        });
        window.addEventListener('test', null, opts);
        window.removeEventListener('test', null, opts);
    } catch (e) {}
    return passive;
})();

// -----------------------------
// Initialize App with Error Handling
// -----------------------------
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        try {
            App.init();
        } catch (error) {
            console.error('❌ App initialization error:', error);
        }
    });
} else {
    try {
        App.init();
    } catch (error) {
        console.error('❌ App initialization error:', error);
    }
}

// Export to window for global access
window.App = App;

// Performance: Log page load time
window.addEventListener('load', () => {
    if (window.performance && window.performance.timing) {
        const loadTime = window.performance.timing.loadEventEnd - window.performance.timing.navigationStart;
        console.log(`⚡ Page loaded in ${loadTime}ms`);
    }
});
