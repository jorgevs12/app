/**
 * 💎 AGENDA CORE SYSTEM (AppDB)
 * Sistema centralizado: Base de Datos + TEMA VISUAL
 */

const App = (function() {
    
    // --- 1. CONFIGURACIÓN ---
    const CONFIG = {
        DB_NAME: 'AgendaDB', 
        VERSION: 21,
        STORES: {
            SALUD: 'health',
            EVENTOS: 'events',
            FINANZAS: 'finance',
            HORARIO: 'schedule',
            NOTAS: 'notes',
            CONFIG: 'settings'
        }
    };

    let dbInstance = null;

    // --- 2. MOTOR DE BASE DE DATOS ---

    function initDB() {
        return new Promise((resolve, reject) => {
            if (dbInstance) return resolve(dbInstance);

            const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.VERSION);

            request.onerror = (e) => reject(e.target.error);

            request.onsuccess = (e) => {
                dbInstance = e.target.result;
                resolve(dbInstance);
                // Una vez conectada la DB, aplicamos el tema visual guardado
                applyThemeGlobal(); 
            };

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                Object.values(CONFIG.STORES).forEach(name => {
                    if (!db.objectStoreNames.contains(name)) {
                        const opts = name === CONFIG.STORES.CONFIG ? { keyPath: 'key' } : { keyPath: 'id', autoIncrement: true };
                        const store = db.createObjectStore(name, opts);
                        if(name !== CONFIG.STORES.CONFIG) {
                            store.createIndex('fecha', 'fecha', { unique: false });
                            store.createIndex('tipo', 'tipo', { unique: false });
                        }
                    }
                });
            };
        });
    }

    function tx(storeName, mode, callback) {
        return initDB().then(db => {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(storeName, mode);
                const store = transaction.objectStore(storeName);
                const request = callback(store);
                if (request) {
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                } else {
                    transaction.oncomplete = () => resolve(true);
                    transaction.onerror = () => reject(transaction.error);
                }
            });
        });
    }

    // --- 3. OPERACIONES CRUD ---

    const CRUD = {
        create: async (storeName, data) => {
            if (!data.fecha && storeName !== CONFIG.STORES.CONFIG) data.fecha = new Date().toISOString();
            return await tx(storeName, 'readwrite', store => store.add(data));
        },
        read: async (storeName) => await tx(storeName, 'readonly', store => store.getAll()),
        readOne: async (storeName, id) => await tx(storeName, 'readonly', store => store.get(id)),
        update: async (storeName, data) => await tx(storeName, 'readwrite', store => store.put(data)),
        delete: async (storeName, id) => await tx(storeName, 'readwrite', store => store.delete(id)),

        // Métodos de Configuración
        setConfig: async (key, value) => {
            await tx(CONFIG.STORES.CONFIG, 'readwrite', store => store.put({ key, value }));
            // Si cambiamos un ajuste, aplicamos el tema inmediatamente
            if(key === 'accentColor' || key === 'enableBlur') applyThemeGlobal();
        },
        getConfig: async (key) => {
            try {
                const res = await tx(CONFIG.STORES.CONFIG, 'readonly', store => store.get(key));
                return res ? res.value : null;
            } catch { return null; }
        },
        getAllConfig: async () => {
            try {
                const all = await tx(CONFIG.STORES.CONFIG, 'readonly', store => store.getAll());
                return all.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
            } catch { return {}; }
        }
    };

    // --- 4. UTILIDADES (TOAST) ---
    function showToast(message, type = 'success') {
        const existing = document.getElementById('app-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.id = 'app-toast';
        const color = type === 'error' ? '#ff453a' : '#30d158';
        toast.style.cssText = `position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: #1c1c1e; border: 1px solid rgba(255,255,255,0.1); border-left: 3px solid ${color}; color: white; padding: 12px 24px; border-radius: 50px; font-family: system-ui; z-index: 9999; display: flex; gap: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);`;
        toast.innerHTML = `<span>${type==='error'?'⚠️':'✅'}</span><span>${message}</span>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // --- 5. SISTEMA DE TEMA AUTOMÁTICO (NUEVO) ---
    
// --- 5. SISTEMA DE TEMA AUTOMÁTICO (CORREGIDO PARA TU NUEVO CSS) ---
    
    async function applyThemeGlobal() {
        try {
            const config = await CRUD.getAllConfig();
            const root = document.documentElement;

            // 1. Aplicar Color de Acento
            if (config.accentColor) {
                // Tu CSS usa --accent-blue como color principal en los textos y bordes
                root.style.setProperty('--accent-blue', config.accentColor);
            }

            // 2. Aplicar Efecto Blur (Cristal)
            if (config.enableBlur === false) { 
                // MODO RENDIMIENTO (Sin transparencia)
                // Sobrescribimos el gradiente por un color sólido oscuro
                root.style.setProperty('--card-bg', '#1c1c1e'); 
                root.style.setProperty('--blur-strength', '0px');
            } else {
                // MODO CRISTAL (Por defecto)
                // Restauramos el gradiente original de tu CSS o uno similar con transparencia
                root.style.setProperty('--card-bg', 'linear-gradient(180deg, rgba(32, 32, 35, 0.65) 0%, rgba(22, 22, 24, 0.75) 100%)');
                root.style.setProperty('--blur-strength', '40px');
            }

        } catch (e) {
            console.log("Esperando configuración...");
        }
    }

    // Inicializar todo
    initDB();

    return {
        STORES: CONFIG.STORES,
        init: initDB,
        ...CRUD,
        toast: showToast,
        refreshTheme: applyThemeGlobal // Para llamar manualmente si hace falta
    };

})();

window.App = App;
