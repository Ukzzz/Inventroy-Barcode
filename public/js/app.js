// ==========================================================
// Uniform Inventory System - Main JavaScript File
// Handles UI interactions, validation, messages, and utilities
// ==========================================================

const App = {
    // -----------------------------
    // Initialize the application
    // -----------------------------
    init() {
        this.setupEventListeners();
        this.setupTooltips();
        this.setupFormValidation();
        this.setupBarcodePreview();
        console.log('✅ Uniform Inventory System initialized');
    },

    // -----------------------------
    // Setup global event listeners
    // -----------------------------
    setupEventListeners() {
        this.autoHideFlashMessages();
        this.setupMobileMenu();
        this.setupUserDropdown();
        this.setupConfirmationDialogs();
    },

    // -----------------------------
    // Auto-hide flash messages
    // -----------------------------
    autoHideFlashMessages() {
        const flashMessages = document.querySelectorAll('[role="alert"], .alert-message');
        flashMessages.forEach(msg => {
            setTimeout(() => {
                msg.style.opacity = '0';
                msg.style.transition = 'opacity 0.3s ease';
                setTimeout(() => msg.remove(), 300);
            }, 5000);
        });
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
    // Utility Helpers
    // -----------------------------
    utils: {
        formatCurrency(amount) {
            return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(amount);
        },
        formatDate(date) {
            return new Date(date).toLocaleDateString();
        },
        formatDateTime(date) {
            return new Date(date).toLocaleString();
        },
        debounce(func, wait) {
            let timeout;
            return function (...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func(...args), wait);
            };
        },
        copyToClipboard(text) {
            navigator.clipboard.writeText(text)
                .then(() => App.showMessage('Copied to clipboard', 'success'))
                .catch(() => App.showMessage('Failed to copy', 'error'));
        }
    }
};

// -----------------------------
// Initialize App
// -----------------------------
document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
