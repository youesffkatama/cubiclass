/**
 * ==========================================
 * SCHOLAR.AI - PRODUCTION SPA ENGINE
 * ==========================================
 * Architecture: Modular Singleton Pattern
 * Version: 2.0.0
 * Author: Scholar.AI Engineering Team
 */

// ==========================================
// GLOBAL STATE STORE
// ==========================================
const AppState = {
    user: null,
    classes: [],
    pdfs: [],
    tasks: [],
    activities: [],
    chatSessions: [],
    currentChatId: null,
    activeClassId: null,
    settings: {
        theme: 'dark',
        aiModel: 'mistralai/mistral-7b-instruct:free',
        notifications: true,
        aiPersonality: 'friendly'
    }
};


// ==========================================
// API CONFIGURATION - ADD THIS
// ==========================================
// In script.js

/**
 * ==========================================
 * SCHOLAR.AI - PRODUCTION SPA ENGINE
 * ==========================================
 */

// ==========================================
// API CONFIGURATION - MUST BE FIRST!
// ==========================================
const API_CONFIG = {
    baseURL: window.location.hostname.includes('github.dev') || window.location.hostname.includes('app.github.dev')
        ? 'https://studious-space-telegram-5gj47g7j6rvxhvv94-3000.app.github.dev/api/v1'
        : 'http://localhost:3000/api/v1',
    timeout: 30000 // 30 seconds
};

console.log('✅ API_CONFIG loaded:', API_CONFIG);

const API = {
    async request(endpoint, options = {}) {
        const url = `${API_CONFIG.baseURL}${endpoint}`;
        const token = Utils.loadFromStorage('scholar_token');

        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), API_CONFIG.timeout);

        const config = {
            ...options,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` }),
                ...options.headers
            }
        };

        try {
            console.log('📡 API Request:', url, options.method || 'GET');
            
            const response = await fetch(url, config);
            clearTimeout(id);

            let data;
            try {
                data = await response.json();
            } catch (e) {
                data = { error: { message: 'Invalid response from server' } };
            }

            console.log('📡 API Response:', response.status, data);

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    Utils.saveToStorage('scholar_token', null);
                    Utils.saveToStorage('currentUser', null);
                }
                throw new Error(data.error?.message || `Request failed with status ${response.status}`);
            }
            
            return data;
        } catch (error) {
            clearTimeout(id);
            console.error('❌ API Error:', error);
            throw error;
        }
    },
    
    get(endpoint) { return this.request(endpoint, { method: 'GET' }); },
    post(endpoint, body) { 
        console.log('📤 POST Body:', body);
        return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) }); 
    },
    patch(endpoint, body) { return this.request(endpoint, { method: 'PATCH', body: JSON.stringify(body) }); },
    delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); },
};

// In loadSavedSession():
function loadSavedSession() {
    const savedToken = localStorage.getItem('scholar_token');
    const savedUser = localStorage.getItem('currentUser');
    
    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        currentUser = { ...parsedUser, token: savedToken };
        return true; // Session exists
      } catch(e) {
        console.error('Failed to parse saved user:', e);
        localStorage.removeItem('scholar_token');
        localStorage.removeItem('currentUser');
        return false;
      }
    }
    return false;
  };

  let socket = null;

  function initializeSocket(token) {
      if (!token) {
          console.warn('⚠️ No token provided for socket connection');
          return;
      }
      
      try {
          socket = io('http://localhost:3000', {
              auth: { token },
              reconnection: true,
              reconnectionDelay: 1000,
              reconnectionAttempts: 5
          });
          
          socket.on('connect', () => {
              console.log('🔌 Socket connected');
          });
          
          socket.on('connect_error', (error) => {
              console.warn('⚠️ Socket connection error:', error.message);
          });
          
          socket.on('disconnect', () => {
              console.log('🔌 Socket disconnected');
          });
          
          // Real-time PDF processing updates
          socket.on('pdf:processing-started', (data) => {
              Utils.showToast('Processing PDF...', 'info');
          });
          
          socket.on('pdf:progress', (data) => {
              console.log(`PDF Progress: ${data.progress}%`);
              const progressBar = document.getElementById('pdfProgressBar');
              const progressText = document.getElementById('pdfProgressText');
              if (progressBar) progressBar.style.width = `${data.progress}%`;
              if (progressText) progressText.textContent = `${data.progress}%`;
          });
          
          socket.on('pdf:completed', async (data) => {
              Utils.showToast('PDF processing complete!', 'success');
              await PDFModule.loadFiles();
              if (data) {
                  PDFModule.currentPdf = data;
                  PDFModule.showPdfDashboard(data);
              }
          });
          
          socket.on('pdf:failed', (data) => {
              Utils.showToast('PDF processing failed', 'error');
          });
          
          // Real-time XP updates
          socket.on('xp-gained', (data) => {
              if (data.leveledUp) {
                  Utils.showToast(`🎉 Level Up! You're now level ${data.newLevel}!`, 'success');
              } else {
                  Utils.showToast(`+${data.amount} XP: ${data.reason}`, 'success');
              }
              if (AppState.user) {
                  AppState.user.dna.xp = data.newXP;
                  AppState.user.dna.level = data.level;
              }
          });
          
          socket.on('notification', (data) => {
              NotificationSystem.add(data);
          });
          
      } catch (error) {
          console.error('❌ Socket initialization failed:', error);
      }
  }



// ==========================================
// CLASS MANAGEMENT MODULE
// ==========================================
const ClassModule = {
    init: async () => {
        try {
          // Load from API instead of localStorage
          const response = await API.get('/classes');
          AppState.classes = response.data.classes || [];
          ClassModule.renderClassList();
        } catch (error) {
          console.error('Failed to load classes:', error);
          AppState.classes = [];
        }
        
        // Bind color picker
        document.querySelectorAll('.color-dot').forEach(dot => {
          dot.addEventListener('click', (e) => {
            document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
            e.target.classList.add('selected');
          });
        });
      },
      
    
    renderClassList: () => {
        const container = document.getElementById('classListContainer');
        container.innerHTML = '';
        
        AppState.classes.forEach(cls => {
            const link = document.createElement('a');
            link.href = '#';
            link.className = 'nav-link animate__animated animate__fadeInLeft';
            link.innerHTML = `
                <i class="fas fa-book"></i>
                <span>${cls.name}</span>
            `;
            link.addEventListener('click', (e) => {
                e.preventDefault();
                ClassModule.openClass(cls.id);
            });
            container.appendChild(link);
        });
    },
    
    openModal: () => {
        document.getElementById('createClassModal').style.display = 'flex';
        document.getElementById('classNameInput').focus();
    },
    
    closeModal: () => {
        document.getElementById('createClassModal').style.display = 'none';
        document.getElementById('classNameInput').value = '';
        document.getElementById('classDescInput').value = '';
    },
    
    createClass: async () => {
        const name = document.getElementById('classNameInput').value.trim();
        const desc = document.getElementById('classDescInput').value.trim();
        const selectedColor = document.querySelector('.color-dot.selected');
        
        if (!name) {
          Utils.showToast('Please enter a class name', 'error');
          return;
        }
        
        try {
          const response = await API.post('/classes', {
            name,
            description: desc || '',
            color: selectedColor?.getAttribute('data-color') || 'green'
          });
          
          AppState.classes.push(response.data);
          ClassModule.renderClassList();
          ClassModule.closeModal();
          
          Utils.showToast(`Class "${name}" created successfully!`, 'success');
          
          setTimeout(() => ClassModule.openClass(response.data._id), 500);
        } catch (error) {
          Utils.showToast(error.message || 'Failed to create class', 'error');
        }
      },
    
    openClass: (classId) => {
        const cls = AppState.classes.find(c => c.id === classId);
        if (!cls) return;
        
        AppState.activeClassId = classId;
        
        // Hide all views
        document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
        
        // Show class template
        const template = document.getElementById('view-class-template');
        template.style.display = 'block';
        template.classList.add('animate__animated', 'animate__fadeIn');
        
        // Update content
        document.getElementById('classTitle').textContent = cls.name;
        document.getElementById('classDescription').textContent = cls.description;
        document.getElementById('pageTitle').textContent = cls.name;
        
        // Update active state
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    }
};

  
// ==========================================
// ACTIVITY MODULE
// ==========================================
const ActivityModule = {
    // REPLACE ActivityModule.init
    init: async () => {
        try {
          const response = await API.get('/analytics/dashboard');
          AppState.activities = response.data.recentActivity || [];
          ActivityModule.renderFeed();
        } catch (error) {
          console.error('Failed to load activities:', error);
          AppState.activities = [];
        }
      },
          
    renderFeed: () => {
        const feed = document.getElementById('activityFeed');
        if (!feed) return;
        
        feed.innerHTML = '';
        
        AppState.activities.forEach((activity, index) => {
            const item = document.createElement('div');
            item.className = 'activity-item animate__animated animate__fadeInUp';
            item.style.animationDelay = `${index * 0.1}s`;
            item.innerHTML = `
                <div class="act-icon" style="color: ${activity.color}">
                    <i class="fas ${activity.icon}"></i>
                </div>
                <div class="act-details">
                    <h4>${activity.title}</h4>
                    <span>${Utils.formatDate(activity.time)}</span>
                </div>
                <div class="act-score">${activity.score}</div>
            `;
            feed.appendChild(item);
        });
    }
};



// ==========================================
// PARTICLE SYSTEM FOR BACKGROUND
// ==========================================
const ParticleSystem = {
    canvas: null,
    ctx: null,
    particles: [],
    mouse: { x: null, y: null, radius: 150 },
    
    init: () => {
        const canvas = document.createElement('canvas');
        canvas.id = 'particleCanvas';
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '1';
        canvas.style.opacity = '0.6';
        
        document.body.appendChild(canvas);
        
        ParticleSystem.canvas = canvas;
        ParticleSystem.ctx = canvas.getContext('2d');
        
        ParticleSystem.resize();
        ParticleSystem.createParticles();
        ParticleSystem.animate();
        
        window.addEventListener('resize', ParticleSystem.resize);
        window.addEventListener('mousemove', ParticleSystem.handleMouseMove);
    },
    
    resize: () => {
        ParticleSystem.canvas.width = window.innerWidth;
        ParticleSystem.canvas.height = window.innerHeight;
    },
    
    handleMouseMove: (e) => {
        ParticleSystem.mouse.x = e.x;
        ParticleSystem.mouse.y = e.y;
    },
    
    createParticles: () => {
        const particleCount = Math.floor((window.innerWidth * window.innerHeight) / 12000);
        ParticleSystem.particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            ParticleSystem.particles.push({
                x: Math.random() * ParticleSystem.canvas.width,
                y: Math.random() * ParticleSystem.canvas.height,
                radius: Math.random() * 2 + 0.5,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                color: `rgba(0, 237, 100, ${Math.random() * 0.5 + 0.2})`
            });
        }
    },
    
    animate: () => {
        const ctx = ParticleSystem.ctx;
        ctx.clearRect(0, 0, ParticleSystem.canvas.width, ParticleSystem.canvas.height);
        
        ParticleSystem.particles.forEach((particle, index) => {
            // Move particles
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            // Wrap around edges
            if (particle.x < 0) particle.x = ParticleSystem.canvas.width;
            if (particle.x > ParticleSystem.canvas.width) particle.x = 0;
            if (particle.y < 0) particle.y = ParticleSystem.canvas.height;
            if (particle.y > ParticleSystem.canvas.height) particle.y = 0;
            
            // Mouse interaction
            const dx = ParticleSystem.mouse.x - particle.x;
            const dy = ParticleSystem.mouse.y - particle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < ParticleSystem.mouse.radius) {
                const force = (ParticleSystem.mouse.radius - distance) / ParticleSystem.mouse.radius;
                const dirX = dx / distance;
                const dirY = dy / distance;
                particle.x -= dirX * force * 2;
                particle.y -= dirY * force * 2;
            }
            
            // Draw particle
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            ctx.fillStyle = particle.color;
            ctx.fill();
            
            // Connect nearby particles
            for (let j = index + 1; j < ParticleSystem.particles.length; j++) {
                const other = ParticleSystem.particles[j];
                const dx = particle.x - other.x;
                const dy = particle.y - other.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 120) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(0, 237, 100, ${0.2 * (1 - distance / 120)})`;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(particle.x, particle.y);
                    ctx.lineTo(other.x, other.y);
                    ctx.stroke();
                }
            }
        });
        
        requestAnimationFrame(ParticleSystem.animate);
    }
};

// ==========================================
// DYNAMIC CURSOR EFFECT
// ==========================================
const CursorEffect = {
    init: () => {
        // Only init cursor on desktop
        if (window.innerWidth < 768) return;
        
        const cursor = document.createElement('div');
        cursor.className = 'custom-cursor';
        cursor.id = 'customCursor';
        document.body.appendChild(cursor);
        
        const cursorDot = document.createElement('div');
        cursorDot.className = 'cursor-dot';
        cursorDot.id = 'cursorDot';
        document.body.appendChild(cursorDot);
        
        let mouseX = 0, mouseY = 0;
        let cursorX = 0, cursorY = 0;
        let dotX = 0, dotY = 0;
        
        // Track mouse position
        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });
        
        // Animate cursor with RAF
        const animateCursor = () => {
            // Smooth follow
            cursorX += (mouseX - cursorX) * 0.15;
            cursorY += (mouseY - cursorY) * 0.15;
            dotX += (mouseX - dotX) * 0.35;
            dotY += (mouseY - dotY) * 0.35;
            
            cursor.style.left = cursorX + 'px';
            cursor.style.top = cursorY + 'px';
            cursorDot.style.left = dotX + 'px';
            cursorDot.style.top = dotY + 'px';
            
            requestAnimationFrame(animateCursor);
        };
        
        // Start animation
        requestAnimationFrame(animateCursor);
        
        // Scale on hover
        const hoverElements = 'a, button, .nav-link, .feature-card, .btn-icon, .chip, input, textarea, select, .btn-primary, .btn-glass';
        
        document.addEventListener('mouseover', (e) => {
            if (e.target.matches(hoverElements) || e.target.closest(hoverElements)) {
                cursor.style.transform = 'translate(-50%, -50%) scale(1.8)';
                cursor.style.background = 'rgba(0, 237, 100, 0.3)';
                cursor.style.borderColor = '#00ff6a';
            }
        });
        
        document.addEventListener('mouseout', (e) => {
            if (e.target.matches(hoverElements) || e.target.closest(hoverElements)) {
                cursor.style.transform = 'translate(-50%, -50%) scale(1)';
                cursor.style.background = 'rgba(0, 237, 100, 0.1)';
                cursor.style.borderColor = '#00ed64';
            }
        });
        
        console.log('✅ Custom cursor initialized');
    }
};
// ==========================================
// SMOOTH SCROLL & PARALLAX
// ==========================================
const SmoothScroll = {
    init: () => {
        const viewContainer = document.getElementById('viewContainer');
        if (!viewContainer) return;
        
        viewContainer.addEventListener('scroll', () => {
            const scrolled = viewContainer.scrollTop;
            
            // Parallax effect on hero visual
            const heroVisual = document.querySelector('.hero-visual');
            if (heroVisual) {
                heroVisual.style.transform = `translateY(${scrolled * 0.3}px)`;
            }
            
            // Parallax on floating icons
            document.querySelectorAll('.float-anim').forEach((el, index) => {
                const speed = 0.2 + (index * 0.1);
                el.style.transform = `translateY(${scrolled * speed}px)`;
            });
            
            // Fade in elements on scroll
            document.querySelectorAll('.animate-on-scroll').forEach((el) => {
                const rect = el.getBoundingClientRect();
                if (rect.top < window.innerHeight * 0.8) {
                    el.classList.add('visible');
                }
            });
        });
        
        // Add animate-on-scroll class to elements
        document.querySelectorAll('.feature-card, .activity-item, .timeline-item, .stat-tile').forEach(el => {
            el.classList.add('animate-on-scroll');
        });
    }
};

// ==========================================
// CARD TILT EFFECT (3D)
// ==========================================
const TiltEffect = {
    init: () => {
        const tiltElements = document.querySelectorAll('.feature-card, .pdf-tool-card, .chart-card, .metric-card, .stat-tile');
        
        tiltElements.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                
                const rotateX = ((y - centerY) / centerY) * -10;
                const rotateY = ((x - centerX) / centerX) * 10;
                
                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
            });
        });
    }
};

// ==========================================
// GLOWING BUTTON EFFECT
// ==========================================
const GlowEffect = {
    init: () => {
        document.querySelectorAll('.btn-primary, .btn-white, .btn-send').forEach(btn => {
            btn.addEventListener('mousemove', (e) => {
                const rect = btn.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                btn.style.setProperty('--mouse-x', x + 'px');
                btn.style.setProperty('--mouse-y', y + 'px');
            });
        });
    }
};

// ==========================================
// RIPPLE EFFECT ON CLICK
// ==========================================
const RippleEffect = {
    init: () => {
        document.addEventListener('click', (e) => {
            const target = e.target.closest('button, .nav-link, .feature-card');
            if (!target) return;
            
            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            
            const rect = target.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            
            target.style.position = 'relative';
            target.style.overflow = 'hidden';
            target.appendChild(ripple);
            
            setTimeout(() => ripple.remove(), 600);
        });
    }
};

// ==========================================
// TYPING EFFECT FOR HERO
// ==========================================
const TypingEffect = {
    init: () => {
        const heroTitle = document.querySelector('.hero-content h1');
        if (!heroTitle || heroTitle.dataset.typed) return;
        
        const text = heroTitle.textContent;
        heroTitle.textContent = '';
        heroTitle.style.opacity = '1';
        heroTitle.dataset.typed = 'true';
        
        let index = 0;
        const type = () => {
            if (index < text.length) {
                heroTitle.textContent += text.charAt(index);
                index++;
                setTimeout(type, 50);
            }
        };
        
        setTimeout(type, 500);
    }
};

// ==========================================
// NOTIFICATION SYSTEM
// ==========================================
const NotificationSystem = {
    init: () => {
        // Create notification panel
        const panel = document.createElement('div');
        panel.id = 'notificationPanel';
        panel.className = 'notification-panel';
        panel.style.display = 'none';
        document.body.appendChild(panel);
        
        // Bind notification button
        const notifBtn = document.querySelector('.topbar-right .btn-icon[title="Notifications"]');
        if (notifBtn) {
            notifBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                NotificationSystem.togglePanel();
            });
        }
        
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!panel.contains(e.target) && panel.style.display === 'block') {
                NotificationSystem.closePanel();
            }
        });
    },
    
    togglePanel: () => {
        const panel = document.getElementById('notificationPanel');
        if (panel.style.display === 'none') {
            NotificationSystem.openPanel();
        } else {
            NotificationSystem.closePanel();
        }
    },
    
    openPanel: () => {
        const panel = document.getElementById('notificationPanel');
        panel.innerHTML = `
            <div class="notification-header">
                <h3>Notifications</h3>
                <button class="btn-text-sm" onclick="NotificationSystem.clearAll()">Clear All</button>
            </div>
            <div class="notification-list">
                ${NotificationSystem.notifications.map(notif => `
                    <div class="notification-item animate__animated animate__fadeInRight">
                        <div class="notif-icon ${notif.type}">
                            <i class="fas ${notif.icon}"></i>
                        </div>
                        <div class="notif-content">
                            <h4>${notif.title}</h4>
                            <p>${notif.message}</p>
                            <span class="notif-time">${notif.time}</span>
                        </div>
                        <button class="btn-notif-close" onclick="NotificationSystem.remove(${notif.id})">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
        panel.style.display = 'block';
        panel.classList.add('animate__animated', 'animate__fadeInDown');
    },
    
    closePanel: () => {
        const panel = document.getElementById('notificationPanel');
        panel.classList.remove('animate__fadeInDown');
        panel.classList.add('animate__fadeOutUp');
        setTimeout(() => {
            panel.style.display = 'none';
            panel.classList.remove('animate__fadeOutUp');
        }, 300);
    },
    
    remove: (id) => {
        NotificationSystem.notifications = NotificationSystem.notifications.filter(n => n.id !== id);
        NotificationSystem.openPanel();
        
        // Update badge
        const badge = document.querySelector('.notification-dot');
        if (badge && NotificationSystem.notifications.length === 0) {
            badge.style.display = 'none';
        } else if (badge) {
            badge.textContent = NotificationSystem.notifications.length;
        }
    },
    
    clearAll: () => {
        NotificationSystem.notifications = [];
        NotificationSystem.closePanel();
        const badge = document.querySelector('.notification-dot');
        if (badge) badge.style.display = 'none';
    },
    loadNotifications: async () => {
        try {
          const response = await API.get('/notifications');
          NotificationSystem.notifications = response.data.notifications || [];
          
          // Update badge
          const badge = document.querySelector('.notification-dot');
          if (badge) {
            if (response.data.unreadCount > 0) {
              badge.textContent = response.data.unreadCount;
              badge.style.display = 'flex';
            } else {
              badge.style.display = 'none';
            }
          }
        } catch (error) {
          console.error('Failed to load notifications:', error);
        }
      },
      
      add: (notification) => {
        NotificationSystem.notifications.unshift(notification);
        NotificationSystem.loadNotifications();
        
        // Show toast
        Utils.showToast(notification.message, notification.type || 'info');
      }
};

// ==========================================
// REAL-TIME ACTIVITY UPDATES
// ==========================================
const ActivityUpdater = {
    init: () => {
        // Simulate real-time activity updates
        setInterval(() => {
            ActivityUpdater.addRandomActivity();
        }, 30000); // Every 30 seconds
    },
    
    addRandomActivity: () => {
        const activities = [
            { type: 'study', title: 'Study Session Completed', score: '45 min', icon: 'fa-clock', color: '#00ed64' },
            { type: 'quiz', title: 'Quiz Completed', score: '92%', icon: 'fa-check-circle', color: '#00bfff' },
            { type: 'pdf', title: 'PDF Analyzed', score: '15 pages', icon: 'fa-file-pdf', color: '#bd00ff' }
        ];
        
        const randomActivity = activities[Math.floor(Math.random() * activities.length)];
        randomActivity.time = Date.now();
        
        AppState.activities.unshift(randomActivity);
        if (AppState.activities.length > 10) AppState.activities.pop();
        
        // Use setTimeout to defer execution
        setTimeout(() => {
            if (typeof ActivityModule !== 'undefined' && ActivityModule.renderFeed) {
                ActivityModule.renderFeed();
            }
        }, 0);
    }
};

// ==========================================
// KEYBOARD SHORTCUTS
// ==========================================
const KeyboardShortcuts = {
    init: () => {
        document.addEventListener('keydown', (e) => {
            // Cmd/Ctrl + K - Focus search
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                document.getElementById('globalSearch')?.focus();
            }
            
            // Cmd/Ctrl + N - New class
            if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
                e.preventDefault();
                ClassModule.openModal();
            }
            
            // Cmd/Ctrl + U - Upload PDF
            if ((e.metaKey || e.ctrlKey) && e.key === 'u') {
                e.preventDefault();
                document.getElementById('pdfFileInput')?.click();
            }
            
            // Escape - Close modals
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay').forEach(modal => {
                    modal.style.display = 'none';
                });
                NotificationSystem.closePanel();
            }
        });
    }
};

// ==========================================
// LOADING ANIMATIONS
// ==========================================
const LoadingAnimations = {
    init: () => {
        // Add loading states to buttons
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-primary, .btn-upload');
            if (!btn || btn.disabled) return;
            
            // Don't add loading to certain buttons
            if (btn.closest('.modal-footer') || btn.id === 'loginForm' || btn.id === 'signupForm') {
                return;
            }
            
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            btn.disabled = true;
            
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.disabled = false;
            }, 2000);
        });
    }
};

// ==========================================
// PROGRESSIVE LOADING
// ==========================================
const ProgressiveLoader = {
    init: () => {
        // Show skeleton loaders for dynamic content
        const containers = document.querySelectorAll('[data-load]');
        containers.forEach(container => {
            ProgressiveLoader.showSkeleton(container);
            setTimeout(() => {
                ProgressiveLoader.loadContent(container);
            }, 1000);
        });
    },
    
    showSkeleton: (container) => {
        const count = container.dataset.loadCount || 3;
        container.innerHTML = Array(parseInt(count)).fill(0).map(() => `
            <div class="skeleton" style="height: 80px; margin-bottom: 12px; border-radius: 12px;"></div>
        `).join('');
    },
    
    loadContent: (container) => {
        // Load actual content based on data attribute
        const type = container.dataset.load;
        if (type === 'activity') {
            ActivityModule.renderFeed();
        }
    }
};

// ==========================================
// ENHANCE EXISTING AUTH MODULE
// ==========================================
const EnhancedAuth = {
    init: () => {
        // Add loading animations to auth forms
        const loginForm = document.getElementById('loginForm');
        const signupForm = document.getElementById('signupForm');
        
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                const btn = e.target.querySelector('button[type="submit"]');
                btn.classList.add('loading');
            });
        }
        
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => {
                const btn = e.target.querySelector('button[type="submit"]');
                btn.classList.add('loading');
            });
        }
    }
};

// ==========================================
// INITIALIZE ALL EFFECTS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Wait for app to fully load
    setTimeout(() => {
        console.log('🎨 Initializing Dynamic Effects...');
        
        ParticleSystem.init();
        CursorEffect.init();
        SmoothScroll.init();
        TiltEffect.init();
        GlowEffect.init();
        RippleEffect.init();
        NotificationSystem.init();
        KeyboardShortcuts.init();
        LoadingAnimations.init();
        ActivityUpdater.init();
        EnhancedAuth.init();
        
        // Re-initialize effects after navigation
        const observer = new MutationObserver(() => {
            TiltEffect.init();
            SmoothScroll.init();
            TypingEffect.init();
        });
        
        const viewContainer = document.getElementById('viewContainer');
        if (viewContainer) {
            observer.observe(viewContainer, {
                childList: true,
                subtree: true
            });
        }
        
        // Initialize typing effect
        TypingEffect.init();
        
        console.log('✨ All dynamic effects loaded!');
    }, 1500);
});

// Export for external use
window.ScholarAI = {
    ...window.ScholarAI,
    ParticleSystem,
    CursorEffect,
    SmoothScroll,
    TiltEffect,
    GlowEffect,
    NotificationSystem
};

// ==========================================
// ENHANCED CLASS MODULE
// ==========================================
const EnhancedClassModule = {
    currentTab: 'stream',
    posts: [],
    
    init: () => {
        // Initialize class view when opened
        document.addEventListener('class-view-opened', (e) => {
            EnhancedClassModule.setupClassView(e.detail.classId);
        });
    },
    
    setupClassView: (classId) => {
        const classData = AppState.classes.find(c => c.id === classId);
        if (!classData) return;
        
        // Setup tabs
        EnhancedClassModule.setupTabs();
        
        // Setup composer
        EnhancedClassModule.setupComposer();
        
        // Load posts
        EnhancedClassModule.loadPosts(classId);
        
        // Setup new material button
        document.querySelector('.btn-new-material')?.addEventListener('click', () => {
            EnhancedClassModule.openMaterialModal();
        });
        
        // Setup invite button
        document.querySelector('.btn-invite')?.addEventListener('click', () => {
            EnhancedClassModule.openInviteModal();
        });
    },
    
    setupTabs: () => {
        document.querySelectorAll('.class-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active from all
                document.querySelectorAll('.class-tab').forEach(t => t.classList.remove('active'));
                
                // Add active to clicked
                tab.classList.add('active');
                
                // Get tab name
                const tabName = tab.textContent.toLowerCase().trim();
                EnhancedClassModule.currentTab = tabName;
                
                // Show appropriate content
                EnhancedClassModule.showTabContent(tabName);
            });
        });
    },
    
    setupComposer: () => {
        const composer = document.querySelector('.stream-composer');
        if (!composer) return;
        
        const input = composer.querySelector('input');
        if (!input) return;
        
        input.addEventListener('focus', () => {
            composer.style.border = '1px solid var(--primary)';
        });
        
        input.addEventListener('blur', () => {
            if (!input.value) {
                composer.style.border = '1px solid var(--border)';
            }
        });
        
        // Handle post submission
        composer.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                EnhancedClassModule.createPost(input.value.trim());
                input.value = '';
                composer.style.border = '1px solid var(--border)';
            }
        });
    },
    
    createPost: (content) => {
        const post = {
            id: Utils.generateId(),
            author: AppState.user.name,
            avatar: AppState.user.avatar,
            content: content,
            timestamp: Date.now(),
            likes: 0,
            comments: []
        };
        
        EnhancedClassModule.posts.unshift(post);
        EnhancedClassModule.renderPosts();
        
        Utils.showToast('Post created successfully!', 'success');
    },
    
    renderPosts: () => {
        const streamContainer = document.querySelector('.class-stream');
        if (!streamContainer) return;
        
        const emptyState = streamContainer.querySelector('.empty-stream');
        if (emptyState && EnhancedClassModule.posts.length > 0) {
            emptyState.remove();
        }
        
        const composer = streamContainer.querySelector('.stream-composer');
        
        // Clear existing posts
        streamContainer.querySelectorAll('.stream-post').forEach(p => p.remove());
        
        // Add posts after composer
        EnhancedClassModule.posts.forEach(post => {
            const postEl = EnhancedClassModule.createPostElement(post);
            if (composer) {
                composer.insertAdjacentHTML('afterend', postEl);
            } else {
                streamContainer.insertAdjacentHTML('beforeend', postEl);
            }
        });
        
        // Bind post actions
        EnhancedClassModule.bindPostActions();
    },
    
    createPostElement: (post) => {
        return `
            <div class="stream-post animate__animated animate__fadeInUp" data-post-id="${post.id}">
                <div class="post-header">
                    <img src="${post.avatar}" class="post-avatar" alt="${post.author}">
                    <div class="post-author-info">
                        <div class="post-author-name">${post.author}</div>
                        <div class="post-timestamp">${Utils.formatDate(post.timestamp)}</div>
                    </div>
                    <button class="post-menu" onclick="EnhancedClassModule.showPostMenu('${post.id}')">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                </div>
                <div class="post-content">${post.content}</div>
                <div class="post-actions">
                    <button class="post-action" onclick="EnhancedClassModule.likePost('${post.id}')">
                        <i class="far fa-heart"></i>
                        <span>${post.likes || 0}</span>
                    </button>
                    <button class="post-action" onclick="EnhancedClassModule.commentPost('${post.id}')">
                        <i class="far fa-comment"></i>
                        <span>${post.comments?.length || 0}</span>
                    </button>
                    <button class="post-action">
                        <i class="fas fa-share"></i>
                        <span>Share</span>
                    </button>
                </div>
            </div>
        `;
    },
    
    bindPostActions: () => {
        // Already handled via inline onclick for demo
        // In production, use event delegation
    },
    
    likePost: (postId) => {
        const post = EnhancedClassModule.posts.find(p => p.id === postId);
        if (post) {
            post.likes = (post.likes || 0) + 1;
            EnhancedClassModule.renderPosts();
        }
    },
    
    commentPost: (postId) => {
        Utils.showToast('Comment feature coming soon!', 'info');
    },
    
    showPostMenu: (postId) => {
        Utils.showToast('Post options: Edit, Delete, Report', 'info');
    },
    
    loadPosts: (classId) => {
        // Load from storage or API
        const savedPosts = Utils.loadFromStorage(`class_posts_${classId}`, []);
        EnhancedClassModule.posts = savedPosts;
        EnhancedClassModule.renderPosts();
    },
    
    showTabContent: (tabName) => {
        const streamContent = document.querySelector('.class-stream');
        
        switch(tabName) {
            case 'stream':
                if (streamContent) streamContent.style.display = 'block';
                break;
            case 'classwork':
                if (streamContent) streamContent.style.display = 'none';
                EnhancedClassModule.showClasswork();
                break;
            case 'people':
                if (streamContent) streamContent.style.display = 'none';
                EnhancedClassModule.showPeople();
                break;
            case 'grades':
                if (streamContent) streamContent.style.display = 'none';
                EnhancedClassModule.showGrades();
                break;
        }
    },
    
    showClasswork: () => {
        // Implementation for classwork tab
        Utils.showToast('Classwork tab - Coming soon!', 'info');
    },
    
    showPeople: () => {
        // Implementation for people tab
        Utils.showToast('People tab - Coming soon!', 'info');
    },
    
    showGrades: () => {
        // Implementation for grades tab
        Utils.showToast('Grades tab - Coming soon!', 'info');
    },
    
    openMaterialModal: () => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay material-modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-card animate__animated animate__zoomIn">
                <div class="modal-header">
                    <h3>Add New Material</h3>
                    <button class="btn-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="material-type-selector">
                        <div class="material-type" data-type="assignment">
                            <i class="fas fa-tasks"></i>
                            <span>Assignment</span>
                        </div>
                        <div class="material-type" data-type="quiz">
                            <i class="fas fa-question-circle"></i>
                            <span>Quiz</span>
                        </div>
                        <div class="material-type" data-type="material">
                            <i class="fas fa-file-alt"></i>
                            <span>Material</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Title</label>
                        <input type="text" id="materialTitle" placeholder="Enter title...">
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea id="materialDesc" rows="4" placeholder="Add details..."></textarea>
                    </div>
                    <div class="form-group">
                        <label>Due Date</label>
                        <input type="date" id="materialDate">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-text" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button class="btn-primary" onclick="EnhancedClassModule.createMaterial()">Create</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Handle type selection
        modal.querySelectorAll('.material-type').forEach(type => {
            type.addEventListener('click', () => {
                modal.querySelectorAll('.material-type').forEach(t => t.classList.remove('selected'));
                type.classList.add('selected');
            });
        });
    },
    
    createMaterial: () => {
        const title = document.getElementById('materialTitle').value;
        const desc = document.getElementById('materialDesc').value;
        const date = document.getElementById('materialDate').value;
        const type = document.querySelector('.material-type.selected')?.dataset.type;
        
        if (!title || !type) {
            Utils.showToast('Please fill in all required fields', 'error');
            return;
        }
        
        Utils.showToast(`${type} "${title}" created successfully!`, 'success');
        document.querySelector('.material-modal').remove();
    },
    
    openInviteModal: () => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-card animate__animated animate__zoomIn">
                <div class="modal-header">
                    <h3>Invite to Class</h3>
                    <button class="btn-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Email Addresses</label>
                        <input type="email" placeholder="Enter email addresses separated by commas">
                    </div>
                    <div class="form-group">
                        <label>Or share this code:</label>
                        <div style="background: rgba(0,237,100,0.1); padding: 1rem; border-radius: 8px; text-align: center; font-family: var(--font-code); font-size: 1.5rem; color: var(--primary); font-weight: 700;">
                            ABC-DEF-123
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-text" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button class="btn-primary">Send Invites</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
};

// Update ClassModule.openClass to trigger enhanced version
const originalOpenClass = ClassModule.openClass;
ClassModule.openClass = function(classId) {
    originalOpenClass.call(this, classId);
    
    // Trigger enhanced setup
    setTimeout(() => {
        const event = new CustomEvent('class-view-opened', { detail: { classId } });
        document.dispatchEvent(event);
    }, 100);
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        EnhancedClassModule.init();
        console.log('✅ Enhanced Class Module loaded');
    }, 1000);
});

// Export
window.ScholarAI = {
    ...window.ScholarAI,
    EnhancedClassModule
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
const Utils = {
    // Generate unique ID
    generateId: () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    
    // Show toast notification
    showToast: (message, type = 'info') => {
        console.log(`🔔 Toast: [${type}] ${message}`);
        
        const container = document.getElementById('toastContainer');
        if (!container) {
            console.error('❌ Toast container not found');
            return;
        }
        
        const toast = document.createElement('div');
        toast.className = `toast ${type} animate__animated animate__fadeInRight`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            info: 'fa-info-circle'
        };
        
        toast.innerHTML = `
            <i class="fas ${icons[type]}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.remove('animate__fadeInRight');
            toast.classList.add('animate__fadeOutRight');
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    },

    // Show global loader
    showLoader: (message = 'Processing...') => {
        const loader = document.getElementById('globalLoader');
        const text = loader.querySelector('.loader-text');
        if (text) text.textContent = message;
        loader.style.display = 'flex';
    },
    
    // Hide global loader
    hideLoader: () => {
        document.getElementById('globalLoader').style.display = 'none';
    },
    
    // Typewriter effect
    typeWriter: async (element, text, speed = 20) => {
        element.textContent = '';
        for (let i = 0; i < text.length; i++) {
            element.textContent += text.charAt(i);
            await new Promise(resolve => setTimeout(resolve, speed));
        }
    },
    
    // Animate number
    animateNumber: (element, start, end, duration = 1000) => {
        const range = end - start;
        const increment = range / (duration / 16);
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
                element.textContent = Math.round(end);
                clearInterval(timer);
            } else {
                element.textContent = Math.round(current);
            }
        }, 16);
    },
    
    // Format date
    formatDate: (date) => {
        const d = new Date(date);
        const now = new Date();
        const diff = now - d;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return d.toLocaleDateString();
    },
    
    // Store data in localStorage
    saveToStorage: (key, data) => {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error('Storage error:', e);
        }
    },
    
    // Load data from localStorage
    loadFromStorage: (key, defaultValue = null) => {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.error('Storage error:', e);
            return defaultValue;
        }
    }
};

// ==========================================
// AUTHENTICATION MODULE
// ==========================================
// ========== AUTH MODULE UPDATES ==========
// In script.js

// In script.js - Replace AuthModule.init with this:

// ==========================================
// AUTHENTICATION MODULE - FIXED
// ==========================================
const AuthModule = {
    init: async () => {
        console.log('🚀 AuthModule initializing...');
        
        // Wait for DOM
        if (document.readyState === 'loading') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
        }
        
        const splash = document.getElementById('splashScreen');
        const loginContainer = document.getElementById('loginContainer');
        const signupContainer = document.getElementById('signupContainer');
        const appLayer = document.getElementById('appLayer');
        
        // Bind events immediately
        AuthModule.bindEvents();
        
        // Hide splash and check session
        setTimeout(async () => {
            try {
                const token = Utils.loadFromStorage('scholar_token');
                
                if (token) {
                    console.log('🔍 Verifying session...');
                    const response = await API.get('/auth/me');
                    AppState.user = response.data.user;
                    
                    if (typeof initializeSocket === 'function') {
                        initializeSocket(token);
                    }
                    
                    AuthModule.loadApp();
                } else {
                    throw new Error('No session');
                }
            } catch (error) {
                console.log('ℹ️ Showing login screen');
                localStorage.removeItem('scholar_token');
                localStorage.removeItem('currentUser');
                AppState.user = null;
                
                if (appLayer) appLayer.style.display = 'none';
                if (signupContainer) signupContainer.style.display = 'none';
                if (loginContainer) {
                    loginContainer.style.display = 'flex';
                    loginContainer.classList.add('show');
                }
            } finally {
                if (splash) {
                    splash.style.opacity = '0';
                    setTimeout(() => splash.style.display = 'none', 500);
                }
            }
        }, 1500);
    },
    
    bindEvents: () => {
        console.log('🔗 Binding events...');
        
        // Wait a moment for DOM
        setTimeout(() => {
            // LOGIN FORM
            const loginForm = document.getElementById('loginForm');
            const loginBtn = document.querySelector('#loginForm button[type="submit"]');
            
            if (!loginForm) {
                console.error('❌ Login form not found!');
                return;
            }
            
            console.log('✅ Login form found:', loginForm);
            console.log('✅ Login button found:', loginBtn);
            
            // Remove old listeners
            const newLoginForm = loginForm.cloneNode(true);
            loginForm.parentNode.replaceChild(newLoginForm, loginForm);
            
            // Add new listener
            document.getElementById('loginForm').addEventListener('submit', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                console.log('🔥 LOGIN FORM SUBMITTED!');
                AuthModule.handleLogin(e);
            }, true);
            
            // Also bind to button directly
            const loginButton = document.querySelector('#loginForm button[type="submit"]');
            if (loginButton) {
                loginButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🔥 LOGIN BUTTON CLICKED!');
                    document.getElementById('loginForm').dispatchEvent(new Event('submit'));
                }, true);
            }
            
            // SIGNUP FORM
            const signupForm = document.getElementById('signupForm');
            const signupBtn = document.querySelector('#signupForm button[type="submit"]');
            
            if (!signupForm) {
                console.error('❌ Signup form not found!');
                return;
            }
            
            console.log('✅ Signup form found:', signupForm);
            console.log('✅ Signup button found:', signupBtn);
            
            // Remove old listeners
            const newSignupForm = signupForm.cloneNode(true);
            signupForm.parentNode.replaceChild(newSignupForm, signupForm);
            
            // Add new listener
            document.getElementById('signupForm').addEventListener('submit', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                console.log('🔥 SIGNUP FORM SUBMITTED!');
                AuthModule.handleSignup(e);
            }, true);
            
            // Also bind to button directly
            const signupButton = document.querySelector('#signupForm button[type="submit"]');
            if (signupButton) {
                signupButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🔥 SIGNUP BUTTON CLICKED!');
                    document.getElementById('signupForm').dispatchEvent(new Event('submit'));
                }, true);
            }
            
            // Navigation
            const goToSignup = document.getElementById('goToSignup');
            const goToLogin = document.getElementById('goToLogin');
            
            if (goToSignup) {
                goToSignup.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log('🔄 Switching to signup');
                    document.getElementById('loginContainer').style.display = 'none';
                    document.getElementById('signupContainer').style.display = 'flex';
                    document.getElementById('signupContainer').classList.add('show');
                });
            }
            
            if (goToLogin) {
                goToLogin.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log('🔄 Switching to login');
                    document.getElementById('signupContainer').style.display = 'none';
                    document.getElementById('loginContainer').style.display = 'flex';
                    document.getElementById('loginContainer').classList.add('show');
                });
            }
            
            console.log('✅ All events bound');
        }, 200);
    },
    
    handleLogin: async (e) => {
        console.log('🔐 HANDLE LOGIN CALLED');

        try {
            const email = document.getElementById('loginEmail')?.value?.trim();
            const password = document.getElementById('loginPassword')?.value;

            console.log('📧 Credentials:', { email, passwordLength: password?.length });

            if (!email || !password) {
                Utils.showToast('Please enter email and password', 'error');
                return;
            }

            const btn = document.querySelector('#loginForm button[type="submit"]');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
            btn.disabled = true;

            console.log('🚀 Sending login request via API');

            // ✅ USE API.post instead of direct fetch
            const data = await API.post('/auth/login', { email, password });

            console.log('📦 Login response:', data);

            Utils.saveToStorage('scholar_token', data.data.tokens.accessToken);
            Utils.saveToStorage('currentUser', JSON.stringify(data.data.user));
            AppState.user = data.data.user;

            Utils.showToast('Welcome back!', 'success');

            document.getElementById('loginContainer').style.display = 'none';
            AuthModule.loadApp();

        } catch (error) {
            console.error('❌ Login error:', error);
            Utils.showToast(error.message || 'Login failed', 'error');
            const btn = document.querySelector('#loginForm button[type="submit"]');
            if (btn) {
                btn.innerHTML = '<span>Sign In</span><i class="fas fa-arrow-right"></i>';
                btn.disabled = false;
            }
        }
    },
    
    handleSignup: async (e) => {
        console.log('📝 HANDLE SIGNUP CALLED');

        try {
            const firstName = document.getElementById('signupFirstName')?.value?.trim();
            const lastName = document.getElementById('signupLastName')?.value?.trim();
            const email = document.getElementById('signupEmail')?.value?.trim();
            const password = document.getElementById('signupPassword')?.value;
            const education = document.getElementById('signupEducation')?.value;

            console.log('📋 Form data:', { firstName, lastName, email, education, passwordLength: password?.length });

            if (!firstName || !lastName || !email || !password || !education) {
                Utils.showToast('Please fill in all fields', 'error');
                return;
            }

            if (password.length < 8) {
                Utils.showToast('Password must be at least 8 characters', 'error');
                return;
            }

            const btn = document.querySelector('#signupForm button[type="submit"]');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
            btn.disabled = true;

            const requestBody = {
                username: `${firstName.toLowerCase()}${Math.floor(Math.random() * 10000)}`,
                email: email,
                password: password,
                profile: { firstName, lastName },
                educationLevel: education
            };

            console.log('🚀 Sending signup request via API');
            console.log('📤 Request body:', requestBody);

            // ✅ USE API.post instead of direct fetch
            const data = await API.post('/auth/register', requestBody);

            console.log('📦 Signup response:', data);

            Utils.saveToStorage('scholar_token', data.data.tokens.accessToken);
            Utils.saveToStorage('currentUser', JSON.stringify(data.data.user));
            AppState.user = data.data.user;

            Utils.showToast('Account created!', 'success');

            document.getElementById('signupContainer').style.display = 'none';
            AuthModule.loadApp();

        } catch (error) {
            console.error('❌ Signup error:', error);
            Utils.showToast(error.message || 'Signup failed', 'error');
            const btn = document.querySelector('#signupForm button[type="submit"]');
            if (btn) {
                btn.innerHTML = '<span>Create Account</span><i class="fas fa-arrow-right"></i>';
                btn.disabled = false;
            }
        }
    },
    
    loadApp: () => {
        const loginContainer = document.getElementById('loginContainer');
        const signupContainer = document.getElementById('signupContainer');
        const appLayer = document.getElementById('appLayer');
        
        if (loginContainer) loginContainer.style.display = 'none';
        if (signupContainer) signupContainer.style.display = 'none';
        if (appLayer) appLayer.style.display = 'flex';
        
        NavigationModule.init();
        ClassModule.init();
        StatsModule.init();
        ProgressModule.init();
        ActivityModule.init();
        
        const userName = document.getElementById('userName');
        const avatarImg = document.querySelector('.user-profile img');
        
        if (userName) userName.textContent = AppState.user.username || 'Student';
        if (avatarImg) {
            avatarImg.src = AppState.user.profile?.avatar || 
                `https://ui-avatars.com/api/?name=${AppState.user.username}&background=00ed64&color=001e2b`;
        }
        
        NavigationModule.navigateTo('dashboard');
    },
    
    logout: () => {
        Utils.showToast('Logging out...', 'info');
        setTimeout(() => {
            localStorage.clear();
            location.reload();
        }, 1000);
    }
};

// ==========================================
// NAVIGATION MODULE
// ==========================================
const NavigationModule = {
    currentView: 'dashboard',
    
    init: () => {
        // Bind navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.getAttribute('data-view');
                if (view) {
                    NavigationModule.navigateTo(view);
                }
            });
        });
        
        // Mobile menu toggle
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => {
                document.getElementById('sidebar').classList.toggle('active');
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                document.getElementById('globalSearch').focus();
            }
        });
        // Bind create class button
        const btnCreateClass = document.getElementById('btnCreateClass');
        if (btnCreateClass) {
            btnCreateClass.addEventListener('click', () => {
                if (typeof ClassModule !== 'undefined' && ClassModule.openModal) {
                    ClassModule.openModal();
                }
            });
        }
        
        // Load initial view
        NavigationModule.navigateTo('dashboard');
    },
        // Load initial view
    navigateTo: (viewName) => {
        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-view') === viewName) {
                link.classList.add('active');
            }
        });
        
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.style.display = 'none';
            view.classList.remove('active');
        });
        
        // Show target view
        const targetView = document.getElementById(`view-${viewName}`);
        if (targetView) {
            targetView.style.display = 'block';
            targetView.classList.add('active', 'animate__animated', 'animate__fadeIn');
            
            // Update breadcrumb
            const titles = {
                dashboard: 'Dashboard',
                tutor: 'AI Tutor',
                pdfhub: 'PDF Hub',
                flashcards: 'Flashcards',
                stats: 'Analytics',
                progress: 'Progress',
                profile: 'Profile',
                settings: 'Settings'
            };
            
            document.getElementById('pageTitle').textContent = titles[viewName] || 'Workspace';
            
            // Special initializations
            if (viewName === 'stats' && !window.chartsInitialized) {
                StatsModule.initCharts();
            }
            
            NavigationModule.currentView = viewName;
        }
    },
    
    updateHeader: (title, subtitle = '') => {
        document.getElementById('pageTitle').textContent = title;
    }
};

// ==========================================
// AI TUTOR MODULE
// ==========================================
const AIModule = {
    activeTool: null,
    isProcessing: false,
    
    init: () => {
        // Initialize chat sessions
        AppState.chatSessions = Utils.loadFromStorage('scholar_chats', [
            { id: 'demo-1', title: 'Quantum Physics Help', messages: [], timestamp: Date.now() }
        ]);
        
        AIModule.renderChatHistory();
        
        // Bind model selector
        document.getElementById('aiModelSelector').addEventListener('change', (e) => {
            AIModule.changeModel(e.target.value);
        });
    },
    
    renderChatHistory: () => {
        const container = document.getElementById('chatHistoryList');
        if (!container) return;
        
        container.innerHTML = '';
        
        AppState.chatSessions.forEach(session => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <i class="fas fa-comment-alt"></i>
                <span>${session.title}</span>
            `;
            item.addEventListener('click', () => AIModule.loadChat(session.id));
            container.appendChild(item);
        });
    },
    
    changeModel: (model) => {
        AppState.settings.aiModel = model;
        Utils.saveToStorage('scholar_settings', AppState.settings);
        Utils.showToast(`Switched to ${model}`, 'info');
    },
    
    activateTool: (toolName) => {
        AIModule.activeTool = toolName;
        
        // Update UI
        document.querySelectorAll('.chip').forEach(chip => {
            chip.classList.remove('active');
            if (chip.getAttribute('data-tool') === toolName) {
                chip.classList.add('active');
            }
        });
        
        const toolNames = {
            deepsearch: 'Deep Search',
            quiz: 'Quiz Generator',
            exam: 'Exam Prep',
            lecture: 'Lecture Explainer'
        };
        
        Utils.showToast(`${toolNames[toolName]} activated`, 'info');
        document.getElementById('chatInput').placeholder = `Using ${toolNames[toolName]}...`;
    },
    
    handleKeyPress: (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            AIModule.sendMessage();
        }
    },
    
    // REPLACE ENTIRE sendMessage FUNCTION
sendMessage: async () => {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    
    if (!text || AIModule.isProcessing) return;
    
    AIModule.isProcessing = true;
    const messagesContainer = document.getElementById('chatMessages');
    
    // Add user message
    const userMsg = document.createElement('div');
    userMsg.className = 'message user animate__animated animate__fadeInUp';
    userMsg.innerHTML = `
      <div class="message-content">
        <div class="message-bubble">${text}</div>
      </div>
    `;
    messagesContainer.appendChild(userMsg);
    input.value = '';
    
    // Show typing
    const typingMsg = document.createElement('div');
    typingMsg.className = 'message ai animate__animated animate__fadeIn';
    typingMsg.id = 'typingIndicator';
    typingMsg.innerHTML = `
      <div class="message-avatar"><i class="fas fa-robot"></i></div>
      <div class="message-content">
        <div class="message-bubble"><i class="fas fa-spinner fa-spin"></i> Thinking...</div>
      </div>
    `;
    messagesContainer.appendChild(typingMsg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    try {
      // Call streaming API
      const response = await fetch(`${API_CONFIG.baseURL}/intelligence/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Utils.loadFromStorage('scholar_token')}`
        },
        body: JSON.stringify({
          query: text,
          nodeId: PDFModule.currentPdf?._id,
          conversationId: AIModule.currentConversationId
        })
      });
      
      document.getElementById('typingIndicator')?.remove();
      
      const aiMsg = document.createElement('div');
      aiMsg.className = 'message ai animate__animated animate__fadeIn';
      aiMsg.innerHTML = `
        <div class="message-avatar"><i class="fas fa-robot"></i></div>
        <div class="message-content"><div class="message-bubble"></div></div>
      `;
      messagesContainer.appendChild(aiMsg);
      
      const bubble = aiMsg.querySelector('.message-bubble');
      let fullResponse = '';
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              fullResponse += data.content;
              bubble.textContent = fullResponse;
              messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
            if (data.done) AIModule.currentConversationId = data.conversationId;
          }
        }
      }
    } catch (error) {
      document.getElementById('typingIndicator')?.remove();
      Utils.showToast('Chat error: ' + error.message, 'error');
    } finally {
      AIModule.isProcessing = false;
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    },
    generateResponse: (userText) => {
        const responses = {
            quiz: `I've generated a quiz based on "${userText}":

1. What is the main concept?
2. How does this relate to previous topics?
3. Can you provide a practical example?
4. What are the key takeaways?
5. How would you apply this knowledge?

Would you like me to grade your answers?`,
            
            exam: `For exam preparation on "${userText}", here's your study plan:

- Review core concepts (30 min)
- Practice 10 sample questions (45 min)
- Create summary notes (20 min)
- Take a full practice test (60 min)

I can help with any of these steps!`,
            
            deepsearch: `I've searched academic databases for "${userText}":

- 15 relevant research papers found
- 8 educational videos available
- 3 interactive simulations
- Current expert consensus analyzed

Would you like me to summarize the key findings?`,
            
            lecture: `Let me explain "${userText}" in simple terms:

Think of it like this: [key analogy]. The main idea is that [core concept]. This is important because [relevance].

Does this make sense? I can explain any part in more detail!`
        };
        
        if (AIModule.activeTool && responses[AIModule.activeTool]) {
            return responses[AIModule.activeTool];
        }
        
        return `Great question about "${userText}"! Based on my analysis using ${AppState.settings.aiModel}:

The core concept involves detailed explanation and analysis. This connects to related topics and is particularly important for practical application.

Here's a helpful way to think about it: [analogy or example].

Would you like me to:
- Generate practice questions
- Create a summary
- Find related resources
- Explain a specific aspect?`;
    },
    
    newChat: () => {
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.innerHTML = `
            <div class="message ai animate__animated animate__fadeIn">
                <div class="message-avatar"><i class="fas fa-robot"></i></div>
                <div class="message-content">
                    <div class="message-bubble">
                        New session started. How can I help you today?
                    </div>
                </div>
            </div>
        `;
        AIModule.activeTool = null;
        document.querySelectorAll('.chip').forEach(chip => chip.classList.remove('active'));
    },
    
    loadChat: (chatId) => {
        // Implementation for loading previous chat
        Utils.showToast('Loading chat session...', 'info');
    }
};

// ==========================================
// PDF MANAGEMENT MODULE
// ==========================================
const PDFModule = {
    currentPdf: null,
    
    init: () => {
        AppState.pdfs = Utils.loadFromStorage('scholar_pdfs', []);
    },
    
    // REPLACE ENTIRE handleUpload FUNCTION
    handleUpload: async (event) => {
    const file = event.target.files[0];
    if (!file || !file.type.includes('pdf')) {
      Utils.showToast('Please upload a PDF file', 'error');
      return;
    }
    
    if (file.size > 50 * 1024 * 1024) {
      Utils.showToast('File too large. Maximum 50MB', 'error');
      return;
    }
    
    Utils.showLoader('Uploading PDF...');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await API.upload('/workspace/upload', formData);
      
      Utils.hideLoader();
      Utils.showToast('PDF uploaded successfully!', 'success');
      
      // Poll for processing status
      PDFModule.pollProcessingStatus(response.data.nodeId);
    } catch (error) {
      Utils.hideLoader();
      Utils.showToast(error.message || 'Upload failed', 'error');
    }
  },
  
  // ADD THIS NEW FUNCTION TO PDFModule
    loadFiles: async () => {
        try {
        const response = await API.get('/workspace/files');
        AppState.pdfs = response.data.files || [];
        
        // Update UI if on PDF hub
        if (NavigationModule.currentView === 'pdfhub') {
            const emptyState = document.getElementById('pdfEmptyState');
            if (AppState.pdfs.length === 0) {
            emptyState.style.display = 'block';
            } else {
            emptyState.style.display = 'none';
            // Show most recent PDF
            const latestPdf = AppState.pdfs[0];
            PDFModule.currentPdf = latestPdf;
            PDFModule.showPdfDashboard(latestPdf);
            }
        }
        } catch (error) {
        console.error('Failed to load files:', error);
        }
    },
    
    
    pollProcessingStatus: async (nodeId) => {
        Utils.showLoader('Processing PDF...');
        
        const checkStatus = async () => {
        try {
            const response = await API.get(`/workspace/files/${nodeId}/status`);
            
            if (response.data.status === 'INDEXED') {
            Utils.hideLoader();
            Utils.showToast('PDF processing complete!', 'success');
            clearInterval(PDFModule.pollingInterval);
            
            // Load the processed file
            const fileResponse = await API.get(`/workspace/files/${nodeId}`);
            PDFModule.currentPdf = fileResponse.data;
            PDFModule.showPdfDashboard(PDFModule.currentPdf);
            } else if (response.data.status === 'FAILED') {
            Utils.hideLoader();
            Utils.showToast('PDF processing failed', 'error');
            clearInterval(PDFModule.pollingInterval);
            }
        } catch (error) {
            console.error('Status check failed:', error);
        }
        };
        
        await checkStatus();
        PDFModule.pollingInterval = setInterval(checkStatus, 3000);
        },
        pollProcessingStatus: async (nodeId) => {
            let attempts = 0;
            const maxAttempts = 60; // 3 minutes max
            
            const checkStatus = async () => {
                try {
                    const response = await API.get(`/workspace/files/${nodeId}/status`);
                    
                    if (response.data.status === 'INDEXED') {
                        Utils.showToast('PDF processing complete!', 'success');
                        
                        // Get full details
                        const details = await API.get(`/workspace/files/${nodeId}`);
                        
                        // Update UI
                        PDFModule.currentPdf = {
                            id: nodeId,
                            name: details.data.name,
                            pages: details.data.meta.pageCount,
                            flashcards: 15,
                            questions: 8,
                            persona: details.data.persona.generatedName
                        };
                        
                        PDFModule.showPdfDashboard(PDFModule.currentPdf);
                        
                    } else if (response.data.status === 'FAILED') {
                        Utils.showToast('PDF processing failed', 'error');
                    } else if (attempts < maxAttempts) {
                        attempts++;
                        setTimeout(checkStatus, 3000);
                    }
                } catch (error) {
                    console.error('Status check failed:', error);
                }
            };
            
            setTimeout(checkStatus, 3000);
        },
        showPdfDashboard: (pdf) => {
            document.getElementById('pdfEmptyState').style.display = 'none';
            const dashboard = document.getElementById('pdfDashboard');
            dashboard.style.display = 'block';
            dashboard.classList.add('animate__animated', 'animate__zoomIn');
            
            // Update metadata
            document.getElementById('pdfFileName').textContent = pdf.name;
            document.getElementById('pdfPageCount').textContent = `${pdf.pages} Pages`;
            document.getElementById('pdfPersona').textContent = pdf.persona;
            document.getElementById('flashcardCount').textContent = `${pdf.flashcards} Concepts Generated`;
            document.getElementById('quizCount').textContent = `${pdf.questions} Practice Questions`;
            
            // Generate insights
            const insightsList = document.getElementById('pdfInsightsList');
            insightsList.innerHTML = `
                <li class="animate__animated animate__fadeInRight" style="animation-delay: 0.1s">
                    The document focuses on <strong>advanced mathematical concepts</strong>.
                </li>
                <li class="animate__animated animate__fadeInRight" style="animation-delay: 0.2s">
                    Key formula: <em>∫f(x)dx = F(x) + C</em> identified on page 4.
                </li>
                <li class="animate__animated animate__fadeInRight" style="animation-delay: 0.3s">
                    Suggested prerequisite: <strong>Calculus I & II</strong>.
                </li>
                <li class="animate__animated animate__fadeInRight" style="animation-delay: 0.4s">
                    Difficulty level: <strong>Advanced Undergraduate</strong>.
                </li>
            `;
        },
        
        launchTool: (toolName) => {
            const toolActions = {
                flashcards: () => {
                    FlashcardModule.generateFromPdf(PDFModule.currentPdf);
                    NavigationModule.navigateTo('flashcards');
                },
                summary: () => Utils.showToast('Opening summary view...', 'info'),
                quiz: () => Utils.showToast('Generating quiz questions...', 'info'),
                chat: () => {
                    NavigationModule.navigateTo('tutor');
                    Utils.showToast('Chat with PDF activated', 'success');
                }
            };
            
            if (toolActions[toolName]) {
                toolActions[toolName]();
            }
        }
    };

// ==========================================
// FLASHCARD MODULE
// ==========================================
const FlashcardModule = {
    cards: [],
    currentIndex: 0,
    isFlipped: false,
    
    // REPLACE ENTIRE generateFromPdf FUNCTION
    generateFromPdf: async (nodeId) => {
    Utils.showLoader('Generating flashcards...');
    
    try {
      const response = await API.post('/intelligence/flashcards', {
        nodeId: nodeId,
        count: 10
      });
      
      Utils.hideLoader();
      
      FlashcardModule.cards = response.data.flashcards;
      FlashcardModule.currentIndex = 0;
      FlashcardModule.renderCard();
      FlashcardModule.updateProgress();
      
      Utils.showToast('Flashcards generated!', 'success');
      
      document.removeEventListener('keydown', FlashcardModule.handleKeyPress);
      document.addEventListener('keydown', FlashcardModule.handleKeyPress);
    } catch (error) {
      Utils.hideLoader();
      Utils.showToast('Failed to generate flashcards: ' + error.message, 'error');
    }
    },
    renderCard: () => {
        if (FlashcardModule.cards.length === 0) return;
        
        const card = FlashcardModule.cards[FlashcardModule.currentIndex];
        document.getElementById('flashcardQuestion').textContent = card.question;
        document.getElementById('flashcardAnswer').textContent = card.answer;
        
        const flashcard = document.getElementById('activeFlashcard');
        flashcard.classList.remove('flipped');
        FlashcardModule.isFlipped = false;
    },
    
    flipCard: () => {
        const flashcard = document.getElementById('activeFlashcard');
        flashcard.classList.toggle('flipped');
        FlashcardModule.isFlipped = !FlashcardModule.isFlipped;
    },
    
    markCard: (rating) => {
        if (rating === 'known') {
            Utils.showToast('Great job! 🎉', 'success');
        } else {
            Utils.showToast('Added to review pile', 'info');
        }
        
        FlashcardModule.nextCard();
    },
    
    nextCard: () => {
        if (FlashcardModule.currentIndex < FlashcardModule.cards.length - 1) {
            FlashcardModule.currentIndex++;
            FlashcardModule.renderCard();
            FlashcardModule.updateProgress();
        } else {
            Utils.showToast('Session complete! 🎓', 'success');
        }
    },
    
    updateProgress: () => {
        const total = FlashcardModule.cards.length;
        const current = FlashcardModule.currentIndex + 1;
        const percent = (current / total) * 100;
        
        document.getElementById('flashcardProgress').textContent = `${current}/${total}`;
        document.getElementById('flashcardProgressBar').style.width = `${percent}%`;
    },
    
    handleKeyPress: (e) => {
        if (document.getElementById('view-flashcards').style.display !== 'block') return;
        
        if (e.key === ' ') {
            e.preventDefault();
            FlashcardModule.flipCard();
        } else if (e.key === 'ArrowLeft') {
            FlashcardModule.markCard('again');
        } else if (e.key === 'ArrowRight') {
            FlashcardModule.markCard('known');
        }
    }
};

// ==========================================
// STATISTICS MODULE
// ==========================================
const StatsModule = {
    charts: {},
    init: async () => {
        try {
          const response = await API.get('/analytics/dashboard');
          AppState.stats = {
            studyHours: response.data.stats.studySessions || 0,
            quizScore: 0, // Calculate from quiz data
            retention: 0, // Calculate from activity
            sessions: response.data.stats.recentActivities || 0,
            documents: response.data.stats.totalFiles || 0
          };
        } catch (error) {
          console.error('Failed to load stats:', error);
        }
      },    
    initCharts: () => {
        if (window.chartsInitialized) return;
        
        StatsModule.createPerformanceChart();
        StatsModule.createSubjectChart();
        StatsModule.animateMetrics();
        
        window.chartsInitialized = true;
    },
    
    createPerformanceChart: () => {
        const ctx = document.getElementById('performanceChart');
        if (!ctx) return;
        
        // Generate realistic data
        const days = 30;
        const data = [];
        let value = 65;
        
        for (let i = 0; i < days; i++) {
            value += (Math.random() - 0.4) * 5;
            value = Math.max(60, Math.min(100, value));
            data.push(Math.round(value));
        }
        
        StatsModule.charts.performance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array.from({length: days}, (_, i) => `Day ${i + 1}`),
                datasets: [{
                    label: 'Study Efficiency',
                    data: data,
                    borderColor: '#00ed64',
                    backgroundColor: 'rgba(0, 237, 100, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#001e2b',
                    pointBorderColor: '#00ed64',
                    borderWidth: 3
                }]
            },
                            // ADD THIS TO StatsModule
            async loadPerformanceData() {
                try {
                const response = await API.get('/analytics/performance?days=30');
                const data = response.data.performance;
                
                const labels = Object.keys(data).sort();
                const values = labels.map(date => {
                    const dayData = data[date];
                    return (dayData.chat || 0) + (dayData.study || 0) + (dayData.quiz || 0);
                });
                
                StatsModule.createPerformanceChart(labels, values);
                } catch (error) {
                console.error('Failed to load performance data:', error);
                }
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(6, 47, 63, 0.95)',
                        titleColor: '#00ed64',
                        bodyColor: '#ffffff',
                        borderColor: '#00ed64',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return `Efficiency: ${context.parsed.y}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#9eb3c2' },
                        beginAtZero: false,
                        min: 50,
                        max: 100
                    },
                    x: {
                        grid: { display: false },
                        ticks: { 
                            color: '#9eb3c2',
                            maxTicksLimit: 10,
                            callback: function(value, index) {
                                return index % 5 === 0 ? this.getLabelForValue(value) : '';
                            }
                        }
                    }
                }
            }
        });
    },
    
    createSubjectChart: () => {
        const ctx = document.getElementById('subjectChart');
        if (!ctx) return;
        
        StatsModule.charts.subject = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Mathematics', 'Physics', 'History', 'Computer Science'],
                datasets: [{
                    data: [30, 25, 15, 30],
                    backgroundColor: ['#00ed64', '#00bfff', '#bd00ff', '#ff9800'],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#9eb3c2',
                            padding: 15,
                            font: { 
                                family: 'Plus Jakarta Sans',
                                size: 12 
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(6, 47, 63, 0.95)',
                        titleColor: '#00ed64',
                        bodyColor: '#ffffff',
                        borderColor: '#00ed64',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                return `${label}: ${value}%`;
                            }
                        }
                    }
                }
            }
        });
    },
    
    animateMetrics: () => {
        const sessions = document.getElementById('metricSessions');
        const quizScore = document.getElementById('metricQuizScore');
        const docs = document.getElementById('metricDocs');
        
        if (sessions) Utils.animateNumber(sessions, 0, AppState.stats.sessions, 1500);
        if (docs) Utils.animateNumber(docs, 0, AppState.stats.documents, 1200);
        
        // Animate quiz score
        if (quizScore) {
            let current = 0;
            const target = AppState.stats.quizScore;
            const timer = setInterval(() => {
                current += 2;
                if (current >= target) {
                    quizScore.textContent = `${target}%`;
                    clearInterval(timer);
                } else {
                    quizScore.textContent = `${current}%`;
                }
            }, 30);
        }
    },
    
    updatePeriod: (days) => {
        Utils.showToast(`Updated to last ${days} days`, 'info');
        if (StatsModule.charts.performance) {
            StatsModule.charts.performance.destroy();
            StatsModule.createPerformanceChart();
        }
    }
};

// ==========================================
// PROGRESS MODULE
// ==========================================
const ProgressModule = {
    init: async () => {
        try {
          const response = await API.get('/tasks');
          AppState.tasks = response.data.tasks || [];
          ProgressModule.renderTimeline();
          ProgressModule.updateTaskCount();
        } catch (error) {
          console.error('Failed to load tasks:', error);
          AppState.tasks = [];
          ProgressModule.renderTimeline();
          ProgressModule.updateTaskCount();
        }
      },
    updateTaskCount: () => {
        const pending = AppState.tasks.filter(t => !t.completed).length;
        const textEl = document.getElementById('pendingTasksText');
        if (textEl) {
            textEl.textContent = `${pending} assignment${pending !== 1 ? 's' : ''}`;
        }
    },
    renderTimeline: () => {
        const timeline = document.getElementById('progressTimeline');
        if (!timeline) return;
        
        if (AppState.tasks.length === 0) {
          timeline.innerHTML = `
            <div class="empty-state">
              <i class="fas fa-tasks empty-icon"></i>
              <h3>No Tasks Yet</h3>
              <p>Create your first task to start tracking your progress!</p>
              <button class="btn-primary" onclick="NavigationModule.navigateTo('dashboard')" style="margin-top: 1rem;">
                Get Started
              </button>
            </div>
          `;
          return;
        }
        
        // Existing timeline rendering code...
      }
};




// ==========================================
// APPLICATION INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎓 Scholar.AI - Initializing Application...');
    
    // Initialize authentication
    AuthModule.init();
    
    // Initialize PDF module
    PDFModule.init();
    
    // Initialize AI Tutor
    AIModule.init();
    
    // ✅ ADD THESE LINES:
    // Load initial data if logged in
    const token = Utils.loadFromStorage('scholar_token');
    if (token) {
      initializeSocket(token);
      PDFModule.loadFiles();
      NotificationSystem.loadNotifications();
    }
    
    console.log('✅ Scholar.AI - Ready');
});
// ==========================================
// EXPORT FOR EXTERNAL USE
// ==========================================
window.ScholarAI = {
    AppState,
    Utils,
    AuthModule,
    NavigationModule,
    ClassModule,
    AIModule,
    PDFModule,
    FlashcardModule,
    StatsModule,
    ProgressModule,
    ActivityModule
};
// ==========================================
// INTERNATIONALIZATION MODULE (i18n)
// ==========================================
const i18nModule = {
    currentLanguage: 'en',
    
    translations: {
        en: {
            // Navigation
            nav_dashboard: 'Dashboard',
            nav_tutor: 'AI Tutor',
            nav_pdfhub: 'PDF Hub',
            nav_flashcards: 'Flashcards',
            nav_stats: 'Analytics',
            nav_progress: 'Progress',
            nav_profile: 'Profile',
            nav_settings: 'Settings',
            nav_myclasses: 'My Classes',
            
            // Dashboard
            hero_title: 'Welcome back',
            hero_subtitle: 'Ready to continue your learning journey?',
            hero_cta_start: 'Start Learning',
            hero_cta_explore: 'Explore Features',
            
            // Feature Cards
            feature_tutor_title: 'AI Tutor',
            feature_tutor_desc: 'Get instant help with any topic',
            feature_pdf_title: 'PDF Analysis',
            feature_pdf_desc: 'Extract insights from documents',
            feature_flashcard_title: 'Smart Flashcards',
            feature_flashcard_desc: 'Personalized study cards',
            
            // AI Tutor
            tutor_placeholder: 'Ask me anything...',
            tutor_send: 'Send',
            tutor_new_chat: 'New Chat',
            tutor_model: 'Model',
            tutor_thinking: 'Thinking...',
            
            // Tools
            tool_deepsearch: 'Deep Search',
            tool_quiz: 'Quiz Maker',
            tool_exam: 'Exam Prep',
            tool_lecture: 'Lecture Explainer',
            
            // PDF Hub
            pdf_upload: 'Upload PDF',
            pdf_empty_title: 'No PDFs Yet',
            pdf_empty_desc: 'Upload your first document to get started',
            pdf_processing: 'Processing document...',
            pdf_success: 'PDF processed successfully!',
            
            // Classes
            class_create: 'Create Class',
            class_name: 'Class Name',
            class_description: 'Description',
            class_color: 'Color',
            class_save: 'Save',
            class_cancel: 'Cancel',
            class_created: 'Class created successfully!',
            
            // Stats
            stats_performance: 'Performance',
            stats_subjects: 'Subject Distribution',
            stats_studyhours: 'Study Hours',
            stats_quizscore: 'Quiz Score',
            stats_retention: 'Retention Rate',
            stats_sessions: 'Study Sessions',
            stats_documents: 'Documents',
            
            // Progress
            progress_tasks: 'Tasks',
            progress_completed: 'Completed',
            progress_pending: 'Pending',
            progress_timeline: 'Learning Timeline',
            
            // Flashcards
            flashcard_front: 'Question',
            flashcard_back: 'Answer',
            flashcard_flip: 'Click to flip',
            flashcard_again: 'Study Again',
            flashcard_known: 'I Know This',
            flashcard_complete: 'Session complete!',
            
            // Settings
            settings_theme: 'Theme',
            settings_language: 'Language',
            settings_notifications: 'Notifications',
            settings_ai_model: 'AI Model',
            settings_save: 'Save Changes',
            
            // Auth
            auth_login: 'Login',
            auth_signup: 'Sign Up',
            auth_email: 'Email',
            auth_password: 'Password',
            auth_firstname: 'First Name',
            auth_lastname: 'Last Name',
            auth_remember: 'Remember Me',
            auth_forgot: 'Forgot Password?',
            auth_have_account: 'Already have an account?',
            auth_no_account: "Don't have an account?",
            auth_authenticating: 'Authenticating...',
            auth_creating: 'Creating account...',
            
            // Toasts
            toast_welcome: 'Welcome back to Scholar.AI!',
            toast_logout: 'Logging out...',
            toast_error: 'An error occurred',
            toast_success: 'Success!',
            toast_saved: 'Changes saved',
            
            // Quiz
            quiz_start: 'Start Quiz',
            quiz_submit: 'Submit Quiz',
            quiz_next: 'Next',
            quiz_previous: 'Previous',
            quiz_question: 'Question',
            quiz_of: 'of',
            quiz_timeup: 'Time is up!',
            quiz_results: 'Quiz Results',
            quiz_score: 'Your Score',
            quiz_correct: 'Correct Answers',
            quiz_review: 'Review Answers',
            quiz_back: 'Back to Dashboard',
            
            // Common
            common_search: 'Search...',
            common_loading: 'Loading...',
            common_save: 'Save',
            common_cancel: 'Cancel',
            common_delete: 'Delete',
            common_edit: 'Edit',
            common_close: 'Close',
            common_yes: 'Yes',
            common_no: 'No',
            common_confirm: 'Confirm',
            common_back: 'Back',
            common_next: 'Next',
            common_previous: 'Previous',
            common_finish: 'Finish',
            common_continue: 'Continue'
        },
        
        ar: {
            // Navigation (Right-to-Left)
            nav_dashboard: 'لوحة التحكم',
            nav_tutor: 'المعلم الذكي',
            nav_pdfhub: 'مركز PDF',
            nav_flashcards: 'البطاقات التعليمية',
            nav_stats: 'التحليلات',
            nav_progress: 'التقدم',
            nav_profile: 'الملف الشخصي',
            nav_settings: 'الإعدادات',
            nav_myclasses: 'صفوفي',
            
            // Dashboard
            hero_title: 'مرحباً بعودتك',
            hero_subtitle: 'هل أنت مستعد لمواصلة رحلة التعلم؟',
            hero_cta_start: 'ابدأ التعلم',
            hero_cta_explore: 'استكشف الميزات',
            
            // Feature Cards
            feature_tutor_title: 'المعلم الذكي',
            feature_tutor_desc: 'احصل على مساعدة فورية في أي موضوع',
            feature_pdf_title: 'تحليل PDF',
            feature_pdf_desc: 'استخرج الرؤى من المستندات',
            feature_flashcard_title: 'بطاقات تعليمية ذكية',
            feature_flashcard_desc: 'بطاقات دراسية مخصصة',
            
            // AI Tutor
            tutor_placeholder: 'اسألني أي شيء...',
            tutor_send: 'إرسال',
            tutor_new_chat: 'محادثة جديدة',
            tutor_model: 'النموذج',
            tutor_thinking: 'أفكر...',
            
            // Tools
            tool_deepsearch: 'بحث عميق',
            tool_quiz: 'صانع الاختبارات',
            tool_exam: 'التحضير للامتحان',
            tool_lecture: 'شرح المحاضرات',
            
            // PDF Hub
            pdf_upload: 'رفع PDF',
            pdf_empty_title: 'لا توجد ملفات PDF بعد',
            pdf_empty_desc: 'قم برفع مستندك الأول للبدء',
            pdf_processing: 'جاري معالجة المستند...',
            pdf_success: 'تمت معالجة PDF بنجاح!',
            
            // Classes
            class_create: 'إنشاء صف',
            class_name: 'اسم الصف',
            class_description: 'الوصف',
            class_color: 'اللون',
            class_save: 'حفظ',
            class_cancel: 'إلغاء',
            class_created: 'تم إنشاء الصف بنجاح!',
            
            // Stats
            stats_performance: 'الأداء',
            stats_subjects: 'توزيع المواد',
            stats_studyhours: 'ساعات الدراسة',
            stats_quizscore: 'نتيجة الاختبار',
            stats_retention: 'معدل الاحتفاظ',
            stats_sessions: 'جلسات الدراسة',
            stats_documents: 'المستندات',
            
            // Progress
            progress_tasks: 'المهام',
            progress_completed: 'مكتمل',
            progress_pending: 'قيد الانتظار',
            progress_timeline: 'الجدول الزمني للتعلم',
            
            // Flashcards
            flashcard_front: 'السؤال',
            flashcard_back: 'الجواب',
            flashcard_flip: 'انقر للقلب',
            flashcard_again: 'ادرس مرة أخرى',
            flashcard_known: 'أعرف هذا',
            flashcard_complete: 'اكتملت الجلسة!',
            
            // Settings
            settings_theme: 'المظهر',
            settings_language: 'اللغة',
            settings_notifications: 'الإشعارات',
            settings_ai_model: 'نموذج الذكاء الاصطناعي',
            settings_save: 'حفظ التغييرات',
            
            // Auth
            auth_login: 'تسجيل الدخول',
            auth_signup: 'إنشاء حساب',
            auth_email: 'البريد الإلكتروني',
            auth_password: 'كلمة المرور',
            auth_firstname: 'الاسم الأول',
            auth_lastname: 'اسم العائلة',
            auth_remember: 'تذكرني',
            auth_forgot: 'نسيت كلمة المرور؟',
            auth_have_account: 'هل لديك حساب؟',
            auth_no_account: 'ليس لديك حساب؟',
            auth_authenticating: 'جاري المصادقة...',
            auth_creating: 'جاري إنشاء الحساب...',
            
            // Toasts
            toast_welcome: 'مرحباً بعودتك إلى Scholar.AI!',
            toast_logout: 'جاري تسجيل الخروج...',
            toast_error: 'حدث خطأ',
            toast_success: 'نجح!',
            toast_saved: 'تم حفظ التغييرات',
            
            // Quiz
            quiz_start: 'ابدأ الاختبار',
            quiz_submit: 'إرسال الاختبار',
            quiz_next: 'التالي',
            quiz_previous: 'السابق',
            quiz_question: 'سؤال',
            quiz_of: 'من',
            quiz_timeup: 'انتهى الوقت!',
            quiz_results: 'نتائج الاختبار',
            quiz_score: 'نتيجتك',
            quiz_correct: 'الإجابات الصحيحة',
            quiz_review: 'مراجعة الإجابات',
            quiz_back: 'العودة إلى لوحة التحكم',
            
            // Common
            common_search: 'بحث...',
            common_loading: 'جاري التحميل...',
            common_save: 'حفظ',
            common_cancel: 'إلغاء',
            common_delete: 'حذف',
            common_edit: 'تعديل',
            common_close: 'إغلاق',
            common_yes: 'نعم',
            common_no: 'لا',
            common_confirm: 'تأكيد',
            common_back: 'رجوع',
            common_next: 'التالي',
            common_previous: 'السابق',
            common_finish: 'إنهاء',
            common_continue: 'متابعة'
        },
        
        fr: {
            // Navigation
            nav_dashboard: 'Tableau de bord',
            nav_tutor: 'Tuteur IA',
            nav_pdfhub: 'Hub PDF',
            nav_flashcards: 'Cartes mémoire',
            nav_stats: 'Statistiques',
            nav_progress: 'Progression',
            nav_profile: 'Profil',
            nav_settings: 'Paramètres',
            nav_myclasses: 'Mes cours',
            
            // Dashboard
            hero_title: 'Content de vous revoir',
            hero_subtitle: 'Prêt à continuer votre parcours d\'apprentissage?',
            hero_cta_start: 'Commencer à apprendre',
            hero_cta_explore: 'Explorer les fonctionnalités',
            
            // Feature Cards
            feature_tutor_title: 'Tuteur IA',
            feature_tutor_desc: 'Obtenez une aide instantanée sur n\'importe quel sujet',
            feature_pdf_title: 'Analyse PDF',
            feature_pdf_desc: 'Extraire des informations des documents',
            feature_flashcard_title: 'Cartes mémoire intelligentes',
            feature_flashcard_desc: 'Cartes d\'étude personnalisées',
            
            // AI Tutor
            tutor_placeholder: 'Posez-moi n\'importe quelle question...',
            tutor_send: 'Envoyer',
            tutor_new_chat: 'Nouveau chat',
            tutor_model: 'Modèle',
            tutor_thinking: 'Réflexion...',
            
            // Tools
            tool_deepsearch: 'Recherche approfondie',
            tool_quiz: 'Créateur de quiz',
            tool_exam: 'Préparation aux examens',
            tool_lecture: 'Explicateur de cours',
            
            // PDF Hub
            pdf_upload: 'Télécharger PDF',
            pdf_empty_title: 'Aucun PDF pour le moment',
            pdf_empty_desc: 'Téléchargez votre premier document pour commencer',
            pdf_processing: 'Traitement du document...',
            pdf_success: 'PDF traité avec succès!',
            
            // Classes
            class_create: 'Créer un cours',
            class_name: 'Nom du cours',
            class_description: 'Description',
            class_color: 'Couleur',
            class_save: 'Enregistrer',
            class_cancel: 'Annuler',
            class_created: 'Cours créé avec succès!',
            
            // Stats
            stats_performance: 'Performance',
            stats_subjects: 'Répartition des matières',
            stats_studyhours: 'Heures d\'étude',
            stats_quizscore: 'Score du quiz',
            stats_retention: 'Taux de rétention',
            stats_sessions: 'Sessions d\'étude',
            stats_documents: 'Documents',
            
            // Progress
            progress_tasks: 'Tâches',
            progress_completed: 'Terminé',
            progress_pending: 'En attente',
            progress_timeline: 'Chronologie d\'apprentissage',
            
            // Flashcards
            flashcard_front: 'Question',
            flashcard_back: 'Réponse',
            flashcard_flip: 'Cliquer pour retourner',
            flashcard_again: 'Étudier à nouveau',
            flashcard_known: 'Je sais ça',
            flashcard_complete: 'Session terminée!',
            
            // Settings
            settings_theme: 'Thème',
            settings_language: 'Langue',
            settings_notifications: 'Notifications',
            settings_ai_model: 'Modèle IA',
            settings_save: 'Enregistrer les modifications',
            
            // Auth
            auth_login: 'Connexion',
            auth_signup: 'S\'inscrire',
            auth_email: 'Email',
            auth_password: 'Mot de passe',
            auth_firstname: 'Prénom',
            auth_lastname: 'Nom',
            auth_remember: 'Se souvenir de moi',
            auth_forgot: 'Mot de passe oublié?',
            auth_have_account: 'Vous avez déjà un compte?',
            auth_no_account: 'Vous n\'avez pas de compte?',
            auth_authenticating: 'Authentification...',
            auth_creating: 'Création du compte...',
            
            // Toasts
            toast_welcome: 'Bienvenue sur Scholar.AI!',
            toast_logout: 'Déconnexion...',
            toast_error: 'Une erreur s\'est produite',
            toast_success: 'Succès!',
            toast_saved: 'Modifications enregistrées',
            
            // Quiz
            quiz_start: 'Commencer le quiz',
            quiz_submit: 'Soumettre le quiz',
            quiz_next: 'Suivant',
            quiz_previous: 'Précédent',
            quiz_question: 'Question',
            quiz_of: 'sur',
            quiz_timeup: 'Le temps est écoulé!',
            quiz_results: 'Résultats du quiz',
            quiz_score: 'Votre score',
            quiz_correct: 'Bonnes réponses',
            quiz_review: 'Revoir les réponses',
            quiz_back: 'Retour au tableau de bord',
            
            // Common
            common_search: 'Rechercher...',
            common_loading: 'Chargement...',
            common_save: 'Enregistrer',
            common_cancel: 'Annuler',
            common_delete: 'Supprimer',
            common_edit: 'Modifier',
            common_close: 'Fermer',
            common_yes: 'Oui',
            common_no: 'Non',
            common_confirm: 'Confirmer',
            common_back: 'Retour',
            common_next: 'Suivant',
            common_previous: 'Précédent',
            common_finish: 'Terminer',
            common_continue: 'Continuer'
        },
        
        ru: {
            // Navigation
            nav_dashboard: 'Панель управления',
            nav_tutor: 'ИИ-репетитор',
            nav_pdfhub: 'PDF центр',
            nav_flashcards: 'Карточки',
            nav_stats: 'Аналитика',
            nav_progress: 'Прогресс',
            nav_profile: 'Профиль',
            nav_settings: 'Настройки',
            nav_myclasses: 'Мои курсы',
            
            // Dashboard
            hero_title: 'С возвращением',
            hero_subtitle: 'Готовы продолжить обучение?',
            hero_cta_start: 'Начать обучение',
            hero_cta_explore: 'Изучить функции',
            
            // Feature Cards
            feature_tutor_title: 'ИИ-репетитор',
            feature_tutor_desc: 'Получите мгновенную помощь по любой теме',
            feature_pdf_title: 'Анализ PDF',
            feature_pdf_desc: 'Извлечение информации из документов',
            feature_flashcard_title: 'Умные карточки',
            feature_flashcard_desc: 'Персонализированные учебные карточки',
            
            // AI Tutor
            tutor_placeholder: 'Спросите меня о чем угодно...',
            tutor_send: 'Отправить',
            tutor_new_chat: 'Новый чат',
            tutor_model: 'Модель',
            tutor_thinking: 'Думаю...',
            
            // Tools
            tool_deepsearch: 'Глубокий поиск',
            tool_quiz: 'Создатель тестов',
            tool_exam: 'Подготовка к экзаменам',
            tool_lecture: 'Объяснение лекций',
            
            // PDF Hub
            pdf_upload: 'Загрузить PDF',
            pdf_empty_title: 'Пока нет PDF',
            pdf_empty_desc: 'Загрузите первый документ для начала',
            pdf_processing: 'Обработка документа...',
            pdf_success: 'PDF успешно обработан!',
            
            // Classes
            class_create: 'Создать курс',
            class_name: 'Название курса',
            class_description: 'Описание',
            class_color: 'Цвет',
            class_save: 'Сохранить',
            class_cancel: 'Отмена',
            class_created: 'Курс успешно создан!',
            
            // Stats
            stats_performance: 'Производительность',
            stats_subjects: 'Распределение предметов',
            stats_studyhours: 'Часы учебы',
            stats_quizscore: 'Результат теста',
            stats_retention: 'Уровень запоминания',
            stats_sessions: 'Учебные сессии',
            stats_documents: 'Документы',
            
            // Progress
            progress_tasks: 'Задачи',
            progress_completed: 'Завершено',
            progress_pending: 'В ожидании',
            progress_timeline: 'График обучения',
            
            // Flashcards
            flashcard_front: 'Вопрос',
            flashcard_back: 'Ответ',
            flashcard_flip: 'Нажмите для переворота',
            flashcard_again: 'Повторить',
            flashcard_known: 'Я знаю это',
            flashcard_complete: 'Сессия завершена!',
            
            // Settings
            settings_theme: 'Тема',
            settings_language: 'Язык',
            settings_notifications: 'Уведомления',
            settings_ai_model: 'ИИ модель',
            settings_save: 'Сохранить изменения',
            
            // Auth
            auth_login: 'Войти',
            auth_signup: 'Регистрация',
            auth_email: 'Email',
            auth_password: 'Пароль',
            auth_firstname: 'Имя',
            auth_lastname: 'Фамилия',
            auth_remember: 'Запомнить меня',
            auth_forgot: 'Забыли пароль?',
            auth_have_account: 'Уже есть аккаунт?',
            auth_no_account: 'Нет аккаунта?',
            auth_authenticating: 'Аутентификация...',
            auth_creating: 'Создание аккаунта...',
            
            // Toasts
            toast_welcome: 'Добро пожаловать в Scholar.AI!',
            toast_logout: 'Выход из системы...',
            toast_error: 'Произошла ошибка',
            toast_success: 'Успешно!',
            toast_saved: 'Изменения сохранены',
            
            // Quiz
            quiz_start: 'Начать тест',
            quiz_submit: 'Отправить тест',
            quiz_next: 'Следующий',
            quiz_previous: 'Предыдущий',
            quiz_question: 'Вопрос',
            quiz_of: 'из',
            quiz_timeup: 'Время вышло!',
            quiz_results: 'Результаты теста',
            quiz_score: 'Ваш результат',
            quiz_correct: 'Правильные ответы',
            quiz_review: 'Просмотреть ответы',
            quiz_back: 'Вернуться на панель',
            
            // Common
            common_search: 'Поиск...',
            common_loading: 'Загрузка...',
            common_save: 'Сохранить',
            common_cancel: 'Отмена',
            common_delete: 'Удалить',
            common_edit: 'Редактировать',
            common_close: 'Закрыть',
            common_yes: 'Да',
            common_no: 'Нет',
            common_confirm: 'Подтвердить',
            common_back: 'Назад',
            common_next: 'Далее',
            common_previous: 'Назад',
            common_finish: 'Завершить',
            common_continue: 'Продолжить'
        }
    },
    
    init: () => {
        // Load saved language or detect browser language
        const savedLang = Utils.loadFromStorage('scholar_language', null);
        const browserLang = navigator.language.split('-')[0];
        
        if (savedLang && i18nModule.translations[savedLang]) {
            i18nModule.currentLanguage = savedLang;
        } else if (i18nModule.translations[browserLang]) {
            i18nModule.currentLanguage = browserLang;
        } else {
            i18nModule.currentLanguage = 'en';
        }
        
        i18nModule.applyLanguage();
        i18nModule.createLanguageSelector();
    },
    
    translate: (key) => {
        const lang = i18nModule.currentLanguage;
        return i18nModule.translations[lang][key] || i18nModule.translations['en'][key] || key;
    },
    
    t: (key) => i18nModule.translate(key),
    
    setLanguage: (langCode) => {
        if (!i18nModule.translations[langCode]) {
            console.error(`Language ${langCode} not supported`);
            return;
        }
        
        i18nModule.currentLanguage = langCode;
        Utils.saveToStorage('scholar_language', langCode);
        i18nModule.applyLanguage();
        
        // Handle RTL for Arabic
        if (langCode === 'ar') {
            document.documentElement.setAttribute('dir', 'rtl');
            document.body.classList.add('rtl');
        } else {
            document.documentElement.setAttribute('dir', 'ltr');
            document.body.classList.remove('rtl');
        }
        
        Utils.showToast(`Language changed to ${i18nModule.getLanguageName(langCode)}`, 'success');
    },
    
    applyLanguage: () => {
        // Update all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = i18nModule.translate(key);
            
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.placeholder = translation;
            } else {
                element.textContent = translation;
            }
        });
        
        // Update title attributes
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            element.title = i18nModule.translate(key);
        });
    },
    
    getLanguageName: (code) => {
        const names = {
            en: 'English',
            ar: 'العربية',
            fr: 'Français',
            ru: 'Русский'
        };
        return names[code] || code;
    },
    
    createLanguageSelector: () => {
        const selector = document.getElementById('languageSelector');
        if (!selector) return;
        
        selector.innerHTML = `
            <select onchange="i18nModule.setLanguage(this.value)" class="setting-select">
                <option value="en" ${i18nModule.currentLanguage === 'en' ? 'selected' : ''}>🇬🇧 English</option>
                <option value="ar" ${i18nModule.currentLanguage === 'ar' ? 'selected' : ''}>🇸🇦 العربية</option>
                <option value="fr" ${i18nModule.currentLanguage === 'fr' ? 'selected' : ''}>🇫🇷 Français</option>
                <option value="ru" ${i18nModule.currentLanguage === 'ru' ? 'selected' : ''}>🇷🇺 Русский</option>
            </select>
        `;
    }
};

// ==========================================
// ADVANCED GAMIFICATION MODULE
// ==========================================
const GamificationModule = {
    achievements: [],
    badges: [],
    points: 0,
    level: 1,
    streak: 0,
    
    init: () => {
        GamificationModule.loadProgress();
        GamificationModule.checkDailyStreak();
    },
    
    loadProgress: () => {
        const saved = Utils.loadFromStorage('scholar_gamification', {
            achievements: [],
            badges: [],
            points: 0,
            level: 1,
            streak: 0,
            lastActivity: Date.now()
        });
        
        Object.assign(GamificationModule, saved);
    },
    
    saveProgress: () => {
        Utils.saveToStorage('scholar_gamification', {
            achievements: GamificationModule.achievements,
            badges: GamificationModule.badges,
            points: GamificationModule.points,
            level: GamificationModule.level,
            streak: GamificationModule.streak,
            lastActivity: Date.now()
        });
    },
    
    addPoints: (amount, reason) => {
        GamificationModule.points += amount;
        
        // Check for level up
        const newLevel = Math.floor(GamificationModule.points / 1000) + 1;
        if (newLevel > GamificationModule.level) {
            GamificationModule.level = newLevel;
            GamificationModule.showLevelUp(newLevel);
        }
        
        GamificationModule.saveProgress();
        
        // Show points earned
        Utils.showToast(`+${amount} points: ${reason}`, 'success');
    },
    
    unlockAchievement: (achievementId) => {
        if (GamificationModule.achievements.includes(achievementId)) {
            return;
        }
        
        GamificationModule.achievements.push(achievementId);
        GamificationModule.saveProgress();
        
        const achievement = GamificationModule.getAchievementInfo(achievementId);
        GamificationModule.showAchievementUnlocked(achievement);
    },
    
    getAchievementInfo: (id) => {
        const achievements = {
            first_class: {
                name: 'Class Creator',
                description: 'Created your first class',
                icon: 'fa-graduation-cap',
                points: 50
            },
            first_pdf: {
                name: 'Document Master',
                description: 'Uploaded your first PDF',
                icon: 'fa-file-pdf',
                points: 50
            },
            quiz_master: {
                name: 'Quiz Master',
                description: 'Scored 100% on a quiz',
                icon: 'fa-trophy',
                points: 100
            },
            study_streak_7: {
                name: 'Week Warrior',
                description: '7-day study streak',
                icon: 'fa-fire',
                points: 200
            },
            study_streak_30: {
                name: 'Month Master',
                description: '30-day study streak',
                icon: 'fa-star',
                points: 500
            },
            flashcard_pro: {
                name: 'Flashcard Pro',
                description: 'Completed 100 flashcards',
                icon: 'fa-cards',
                points: 150
            },
            night_owl: {
                name: 'Night Owl',
                description: 'Studied after midnight',
                icon: 'fa-moon',
                points: 75
            },
            early_bird: {
                name: 'Early Bird',
                description: 'Studied before 6 AM',
                icon: 'fa-sun',
                points: 75
            }
        };
        
        return achievements[id] || { name: id, description: 'Achievement', icon: 'fa-award', points: 0 };
    },
    
    showAchievementUnlocked: (achievement) => {
        const overlay = document.createElement('div');
        overlay.className = 'achievement-overlay animate__animated animate__fadeIn';
        overlay.innerHTML = `
            <div class="achievement-card animate__animated animate__bounceIn">
                <div class="achievement-icon">
                    <i class="fas ${achievement.icon}"></i>
                </div>
                <h3>Achievement Unlocked!</h3>
                <h4>${achievement.name}</h4>
                <p>${achievement.description}</p>
                <div class="achievement-points">+${achievement.points} points</div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Add points
        GamificationModule.addPoints(achievement.points, achievement.name);
        
        // Remove after animation
        setTimeout(() => {
            overlay.classList.add('animate__fadeOut');
            setTimeout(() => overlay.remove(), 500);
        }, 3000);
    },
    
    showLevelUp: (newLevel) => {
        const overlay = document.createElement('div');
        overlay.className = 'levelup-overlay animate__animated animate__fadeIn';
        overlay.innerHTML = `
            <div class="levelup-card animate__animated animate__zoomIn">
                <div class="levelup-icon">
                    <i class="fas fa-level-up-alt"></i>
                </div>
                <h2>Level Up!</h2>
                <div class="levelup-number">${newLevel}</div>
                <p>You've reached level ${newLevel}!</p>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        setTimeout(() => {
            overlay.classList.add('animate__fadeOut');
            setTimeout(() => overlay.remove(), 500);
        }, 3000);
    },
    
    checkDailyStreak: () => {
        const lastActivity = GamificationModule.lastActivity || Date.now();
        const daysSince = Math.floor((Date.now() - lastActivity) / (24 * 60 * 60 * 1000));
        
        if (daysSince === 1) {
            // Consecutive day
            GamificationModule.streak++;
            
            // Check for streak achievements
            if (GamificationModule.streak === 7) {
                GamificationModule.unlockAchievement('study_streak_7');
            } else if (GamificationModule.streak === 30) {
                GamificationModule.unlockAchievement('study_streak_30');
            }
        } else if (daysSince > 1) {
            // Streak broken
            GamificationModule.streak = 1;
        }
        
        GamificationModule.saveProgress();
    },
    
    trackActivity: (activityType) => {
        // Award points based on activity
        const pointValues = {
            login: 10,
            create_class: 50,
            upload_pdf: 50,
            complete_quiz: 100,
            complete_flashcard_session: 75,
            study_session: 25
        };
        
        const points = pointValues[activityType] || 10;
        GamificationModule.addPoints(points, activityType.replace(/_/g, ' '));
        
        // Check for specific achievements
        if (activityType === 'create_class' && AppState.classes.length === 1) {
            GamificationModule.unlockAchievement('first_class');
        }
        
        if (activityType === 'upload_pdf' && AppState.pdfs.length === 1) {
            GamificationModule.unlockAchievement('first_pdf');
        }
        
        // Check time-based achievements
        const hour = new Date().getHours();
        if (hour >= 0 && hour < 6) {
            GamificationModule.unlockAchievement('night_owl');
        } else if (hour >= 5 && hour < 7) {
            GamificationModule.unlockAchievement('early_bird');
        }
    }
};

// ==========================================
// DATA VISUALIZATION MODULE
// ==========================================
const VisualizationModule = {
    createHeatmap: (containerId, data) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // Create heatmap calendar (GitHub-style)
        const today = new Date();
        const yearAgo = new Date(today);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        
        const heatmapData = [];
        for (let d = new Date(yearAgo); d <= today; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const activity = data[dateStr] || 0;
            heatmapData.push({
                date: new Date(d),
                value: activity
            });
        }
        
        // Render heatmap
        const html = `
            <div class="heatmap-container">
                <div class="heatmap-grid">
                    ${heatmapData.map(item => `
                        <div class="heatmap-cell" 
                             style="background: rgba(0, 237, 100, ${item.value / 10})"
                             title="${item.date.toLocaleDateString()}: ${item.value} activities">
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    },
    
    createRadarChart: (containerId, data) => {
        const ctx = document.getElementById(containerId);
        if (!ctx) return;
        
        new Chart(ctx, {
            type: 'radar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Skills',
                    data: data.values,
                    backgroundColor: 'rgba(0, 237, 100, 0.2)',
                    borderColor: '#00ed64',
                    pointBackgroundColor: '#00ed64',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#00ed64'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { color: '#9eb3c2' },
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        pointLabels: { color: '#9eb3c2' }
                    }
                }
            }
        });
    },
    
    createProgressCircle: (containerId, percentage, label) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const radius = 60;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percentage / 100) * circumference;
        
        container.innerHTML = `
            <svg class="progress-circle" width="150" height="150">
                <circle class="progress-bg" cx="75" cy="75" r="${radius}"/>
                <circle class="progress-fill" cx="75" cy="75" r="${radius}"
                        style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset}"/>
                <text x="75" y="75" text-anchor="middle" dy=".3em" class="progress-text">
                    ${percentage}%
                </text>
                <text x="75" y="95" text-anchor="middle" class="progress-label">
                    ${label}
                </text>
            </svg>
        `;
    }
};

// ==========================================
// REAL-TIME COLLABORATION MODULE
// ==========================================
const CollaborationRealTimeModule = {
    activeUsers: [],
    room: null,
    
    init: (roomId) => {
        CollaborationRealTimeModule.room = roomId;
        CollaborationRealTimeModule.simulateUsers();
    },
    
    simulateUsers: () => {
        // Simulate other users in the room
        const users = [
            { id: 1, name: 'Sarah Chen', avatar: 'https://ui-avatars.com/api/?name=Sarah+Chen', status: 'online', activity: 'Viewing PDF' },
            { id: 2, name: 'Mike Johnson', avatar: 'https://ui-avatars.com/api/?name=Mike+Johnson', status: 'idle', activity: 'Taking quiz' },
            { id: 3, name: 'Emma Davis', avatar: 'https://ui-avatars.com/api/?name=Emma+Davis', status: 'online', activity: 'In AI chat' }
        ];
        
        CollaborationRealTimeModule.activeUsers = users;
        CollaborationRealTimeModule.renderActiveUsers();
    },
    
    renderActiveUsers: () => {
        const container = document.getElementById('activeUsersContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="active-users-list">
                ${CollaborationRealTimeModule.activeUsers.map(user => `
                    <div class="active-user-card">
                        <img src="${user.avatar}" class="user-avatar-small" alt="${user.name}">
                        <div class="user-info-small">
                            <div class="user-name-small">${user.name}</div>
                            <div class="user-activity-small">${user.activity}</div>
                        </div>
                        <div class="user-status-dot ${user.status}"></div>
                    </div>
                `).join('')}
            </div>
        `;
    },
    
    sendMessage: (message) => {
        // Simulate real-time messaging
        Utils.showToast('Message sent to group', 'success');
    },
    
    shareScreen: () => {
        Utils.showToast('Screen sharing started', 'info');
    }
};

// ==========================================
// VOICE COMMAND MODULE
// ==========================================
const VoiceCommandModule = {
    recognition: null,
    isListening: false,
    
    init: () => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            VoiceCommandModule.recognition = new SpeechRecognition();
            
            VoiceCommandModule.recognition.continuous = false;
            VoiceCommandModule.recognition.interimResults = false;
            VoiceCommandModule.recognition.lang = i18nModule.currentLanguage || 'en-US';
            
            VoiceCommandModule.recognition.onresult = VoiceCommandModule.handleResult;
            VoiceCommandModule.recognition.onerror = VoiceCommandModule.handleError;
            VoiceCommandModule.recognition.onend = () => {
                VoiceCommandModule.isListening = false;
            };
        }
    },
    
    startListening: () => {
        if (!VoiceCommandModule.recognition) {
            Utils.showToast('Voice commands not supported in this browser', 'error');
            return;
        }
        
        VoiceCommandModule.isListening = true;
        VoiceCommandModule.recognition.start();
        Utils.showToast('Listening...', 'info');
    },
    
    stopListening: () => {
        if (VoiceCommandModule.recognition) {
            VoiceCommandModule.recognition.stop();
            VoiceCommandModule.isListening = false;
        }
    },
    
    handleResult: (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        VoiceCommandModule.processCommand(transcript);
    },
    
    handleError: (event) => {
        console.error('Speech recognition error:', event.error);
        Utils.showToast('Voice command error', 'error');
    },
    
    processCommand: (command) => {
        // Navigate commands
        if (command.includes('go to') || command.includes('open')) {
            if (command.includes('dashboard')) {
                NavigationModule.navigateTo('dashboard');
            } else if (command.includes('tutor') || command.includes('ai')) {
                NavigationModule.navigateTo('tutor');
            } else if (command.includes('pdf')) {
                NavigationModule.navigateTo('pdfhub');
            } else if (command.includes('flashcard')) {
                NavigationModule.navigateTo('flashcards');
            } else if (command.includes('stats') || command.includes('analytics')) {
                NavigationModule.navigateTo('stats');
            }
        }
        
        // Action commands
        else if (command.includes('create class')) {
            ClassModule.openModal();
        } else if (command.includes('upload pdf')) {
            document.getElementById('pdfUploadInput')?.click();
        } else if (command.includes('start quiz')) {
            QuizModule.generate('General Knowledge');
        } else if (command.includes('new chat')) {
            AIModule.newChat();
        }
        
        // AI Query
        else if (command.includes('ask') || command.includes('question')) {
            const query = command.replace(/ask|question/gi, '').trim();
            if (query) {
                NavigationModule.navigateTo('tutor');
                document.getElementById('chatInput').value = query;
                AIModule.sendMessage();
            }
        }
        
        Utils.showToast(`Command: ${command}`, 'info');
    }
};

// ==========================================
// STUDY TIMER & POMODORO MODULE
// ==========================================
const StudyTimerModule = {
    timer: null,
    duration: 25 * 60, // 25 minutes default
    remaining: 0,
    isRunning: false,
    isPaused: false,
    sessions: 0,
    
    init: () => {
        StudyTimerModule.remaining = StudyTimerModule.duration;
        StudyTimerModule.createTimerUI();
    },
    
    createTimerUI: () => {
        const container = document.getElementById('studyTimerContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="study-timer">
                <div class="timer-display" id="timerDisplay">25:00</div>
                <div class="timer-controls">
                    <button class="btn-timer-start" onclick="StudyTimerModule.start()">
                        <i class="fas fa-play"></i> Start
                    </button>
                    <button class="btn-timer-pause" onclick="StudyTimerModule.pause()" style="display: none;">
                        <i class="fas fa-pause"></i> Pause
                    </button>
                    <button class="btn-timer-reset" onclick="StudyTimerModule.reset()">
                        <i class="fas fa-redo"></i> Reset
                    </button>
                </div>
                <div class="timer-sessions">
                    <span>Sessions: ${StudyTimerModule.sessions}</span>
                </div>
                <div class="timer-presets">
                    <button onclick="StudyTimerModule.setDuration(15)">15 min</button>
                    <button onclick="StudyTimerModule.setDuration(25)">25 min</button>
                    <button onclick="StudyTimerModule.setDuration(45)">45 min</button>
                    <button onclick="StudyTimerModule.setDuration(60)">60 min</button>
                </div>
            </div>
        `;
    },
    
    start: () => {
        if (StudyTimerModule.isRunning) return;
        
        StudyTimerModule.isRunning = true;
        StudyTimerModule.isPaused = false;
        
        document.querySelector('.btn-timer-start').style.display = 'none';
        document.querySelector('.btn-timer-pause').style.display = 'inline-block';
        
        StudyTimerModule.timer = setInterval(() => {
            if (StudyTimerModule.remaining > 0) {
                StudyTimerModule.remaining--;
                StudyTimerModule.updateDisplay();
            } else {
                StudyTimerModule.complete();
            }
        }, 1000);
        
        GamificationModule.trackActivity('study_session');
    },
    
    pause: () => {
        clearInterval(StudyTimerModule.timer);
        StudyTimerModule.isRunning = false;
        StudyTimerModule.isPaused = true;
        
        document.querySelector('.btn-timer-start').style.display = 'inline-block';
        document.querySelector('.btn-timer-pause').style.display = 'none';
    },
    
    reset: () => {
        clearInterval(StudyTimerModule.timer);
        StudyTimerModule.isRunning = false;
        StudyTimerModule.isPaused = false;
        StudyTimerModule.remaining = StudyTimerModule.duration;
        StudyTimerModule.updateDisplay();
        
        document.querySelector('.btn-timer-start').style.display = 'inline-block';
        document.querySelector('.btn-timer-pause').style.display = 'none';
    },
    
    complete: () => {
        clearInterval(StudyTimerModule.timer);
        StudyTimerModule.isRunning = false;
        StudyTimerModule.sessions++;
        
        // Play sound
        StudyTimerModule.playNotificationSound();
        
        // Show notification
        Utils.showToast('Study session complete! Take a break 🎉', 'success');
        
        // Award points
        GamificationModule.addPoints(25, 'Completed study session');
        
        // Reset timer
        StudyTimerModule.remaining = StudyTimerModule.duration;
        StudyTimerModule.updateDisplay();
        StudyTimerModule.createTimerUI();
    },
    
    setDuration: (minutes) => {
        StudyTimerModule.duration = minutes * 60;
        StudyTimerModule.reset();
    },
    
    updateDisplay: () => {
        const minutes = Math.floor(StudyTimerModule.remaining / 60);
        const seconds = StudyTimerModule.remaining % 60;
        const display = document.getElementById('timerDisplay');
        if (display) {
            display.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    },
    
    playNotificationSound: () => {
        const audio = new AudioContext();
        const oscillator = audio.createOscillator();
        const gainNode = audio.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audio.destination);
        
        oscillator.frequency.value = 800;
        gainNode.gain.setValueAtTime(0.3, audio.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audio.currentTime + 0.5);
        
        oscillator.start(audio.currentTime);
        oscillator.stop(audio.currentTime + 0.5);
    }
};

// ==========================================
// NOTE TAKING MODULE
// ==========================================
const NoteModule = {
    notes: [],
    currentNote: null,
    
    init: () => {
        NoteModule.notes = Utils.loadFromStorage('scholar_notes', []);
        NoteModule.renderNotesList();
    },
    
    createNote: () => {
        const note = {
            id: Utils.generateId(),
            title: 'Untitled Note',
            content: '',
            classId: AppState.activeClassId,
            tags: [],
            created: Date.now(),
            modified: Date.now()
        };
        
        NoteModule.notes.unshift(note);
        NoteModule.currentNote = note;
        NoteModule.openNoteEditor(note);
        NoteModule.saveNotes();
    },
    
    openNoteEditor: (note) => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay note-editor-modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-card note-editor-card">
                <div class="modal-header">
                    <input type="text" class="note-title-input" value="${note.title}" 
                           onchange="NoteModule.updateNoteTitle(this.value)">
                    <button class="btn-close" onclick="NoteModule.closeEditor()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="note-editor-toolbar">
                    <button onclick="document.execCommand('bold')"><i class="fas fa-bold"></i></button>
                    <button onclick="document.execCommand('italic')"><i class="fas fa-italic"></i></button>
                    <button onclick="document.execCommand('underline')"><i class="fas fa-underline"></i></button>
                    <button onclick="document.execCommand('insertUnorderedList')"><i class="fas fa-list-ul"></i></button>
                    <button onclick="document.execCommand('insertOrderedList')"><i class="fas fa-list-ol"></i></button>
                </div>
                <div class="note-editor-content" contenteditable="true" 
                     onblur="NoteModule.updateNoteContent(this.innerHTML)">
                    ${note.content}
                </div>
                <div class="note-editor-footer">
                    <div class="note-meta">
                        Created: ${new Date(note.created).toLocaleDateString()}
                    </div>
                    <button class="btn-primary" onclick="NoteModule.saveAndClose()">
                        <i class="fas fa-save"></i> Save
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    },
    
    updateNoteTitle: (title) => {
        if (NoteModule.currentNote) {
            NoteModule.currentNote.title = title;
            NoteModule.currentNote.modified = Date.now();
        }
    },
    
    updateNoteContent: (content) => {
        if (NoteModule.currentNote) {
            NoteModule.currentNote.content = content;
            NoteModule.currentNote.modified = Date.now();
        }
    },
    
    saveAndClose: () => {
        NoteModule.saveNotes();
        NoteModule.closeEditor();
        Utils.showToast('Note saved successfully', 'success');
    },
    
    closeEditor: () => {
        const modal = document.querySelector('.note-editor-modal');
        if (modal) modal.remove();
    },
    
    saveNotes: () => {
        Utils.saveToStorage('scholar_notes', NoteModule.notes);
    },
    
    renderNotesList: () => {
        const container = document.getElementById('notesListContainer');
        if (!container) return;
        
        if (NoteModule.notes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-sticky-note empty-icon"></i>
                    <p>No notes yet. Create your first note!</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = NoteModule.notes.map(note => `
            <div class="note-card" onclick="NoteModule.openNoteEditor(${JSON.stringify(note).replace(/"/g, '&quot;')})">
                <h4>${note.title}</h4>
                <p class="note-preview">${note.content.substring(0, 100)}...</p>
                <div class="note-footer">
                    <span>${new Date(note.modified).toLocaleDateString()}</span>
                    <button onclick="event.stopPropagation(); NoteModule.deleteNote('${note.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    },
    
    deleteNote: (noteId) => {
        NoteModule.notes = NoteModule.notes.filter(n => n.id !== noteId);
        NoteModule.saveNotes();
        NoteModule.renderNotesList();
        Utils.showToast('Note deleted', 'info');
    }
};

// Initialize all extended modules
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎓 Scholar.AI - Initializing Application...');
    
    // ✅ Initialize auth first
    AuthModule.init();
    PDFModule.init();
    AIModule.init();
    
    // ✅ Initialize ALL visual effects
    setTimeout(() => {
        console.log('🎨 Initializing Dynamic Effects...');
        document.addEventListener('DOMContentLoaded', () => {
    console.log('🎓 Scholar.AI - Initializing Application...');
    
    // ✅ Initialize auth FIRST
    AuthModule.init();
    
    // ✅ Initialize modules
    PDFModule.init();
    AIModule.init();
    
    // ✅ Initialize visual effects AFTER short delay
    setTimeout(() => {
        console.log('🎨 Initializing visual effects...');
        
        // Cursor effect
        CursorEffect.init();
        
        // Other effects
        ParticleSystem.init();
        SmoothScroll.init();
        TiltEffect.init();
        GlowEffect.init();
        RippleEffect.init();
        NotificationSystem.init();
        KeyboardShortcuts.init();
        LoadingAnimations.init();
        ActivityUpdater.init();
        EnhancedAuth.init();
        i18nModule.init();
        GamificationModule.init();
        VoiceCommandModule.init();
        StudyTimerModule.init();
        NoteModule.init();
        
        console.log('✨ All effects loaded!');
    }, 800);
    
    console.log('✅ Scholar.AI - Ready');
});
        ParticleSystem.init();
        CursorEffect.init();
        SmoothScroll.init();
        TiltEffect.init();
        GlowEffect.init();
        RippleEffect.init();
        NotificationSystem.init();
        KeyboardShortcuts.init();
        LoadingAnimations.init();
        ActivityUpdater.init();
        EnhancedAuth.init();
        i18nModule.init();
        GamificationModule.init();
        VoiceCommandModule.init();
        StudyTimerModule.init();
        NoteModule.init();
        
        // Re-initialize on navigation
        const observer = new MutationObserver(() => {
            TiltEffect.init();
            SmoothScroll.init();
        });
        
        const viewContainer = document.getElementById('viewContainer');
        if (viewContainer) {
            observer.observe(viewContainer, {
                childList: true,
                subtree: true
            });
        }
        
        console.log('✨ All dynamic effects loaded!');
    }, 500);  // ✅ Reduced delay for faster load
    
    // ✅ Load initial data if logged in
    const token = Utils.loadFromStorage('scholar_token');
    if (token) {
        initializeSocket(token);
        PDFModule.loadFiles();
        NotificationSystem.loadNotifications();
    }
    
    console.log('✅ Scholar.AI - Ready');
});
// Export extended modules
window.ScholarAI = {
    ...window.ScholarAI,
    i18nModule,
    GamificationModule,
    VisualizationModule,
    CollaborationRealTimeModule,
    VoiceCommandModule,
    StudyTimerModule,
    NoteModule
};

console.log('🚀 Scholar.AI Extended v2.5 - Complete with i18n, Gamification, Voice Commands, Study Timer, and Notes!');
