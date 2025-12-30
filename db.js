

const App = (function() {
    
    // --- 1. CONFIGURACIÓN ---
    const CONFIG = {
        DB_NAME: 'AgendaDB', 
        VERSION: 23, // Versión incrementada
        STORES: {
            SALUD: 'health',
            EVENTOS: 'events',
            FINANZAS: 'finance',
            HORARIO: 'schedule',
            NOTAS: 'notes',
            CONFIG: 'settings',
            PROYECTOS: 'projects',
            TAREAS: 'tasks',     // Tareas sueltas
            INBOX: 'inbox'       // Añadido por si usas el inbox.html
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
                
                // Tareas de inicialización
                applyThemeGlobal(); // 1. Tema
                runDailyCleanup();  // 2. Limpieza automática selectiva

                resolve(dbInstance);
            };

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                Object.values(CONFIG.STORES).forEach(name => {
                    if (!db.objectStoreNames.contains(name)) {
                        const opts = name === CONFIG.STORES.CONFIG ? { keyPath: 'key' } : { keyPath: 'id', autoIncrement: true };
                        const store = db.createObjectStore(name, opts);
                        if(name !== CONFIG.STORES.CONFIG) {
                            if (!store.indexNames.contains('fecha')) store.createIndex('fecha', 'fecha', { unique: false });
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
            if (!data.createdAt && storeName !== CONFIG.STORES.CONFIG) data.createdAt = new Date().toISOString();
            return await tx(storeName, 'readwrite', store => store.add(data));
        },
        read: async (storeName) => await tx(storeName, 'readonly', store => store.getAll()),
        readOne: async (storeName, id) => await tx(storeName, 'readonly', store => store.get(id)),
        update: async (storeName, data) => await tx(storeName, 'readwrite', store => store.put(data)),
        delete: async (storeName, id) => await tx(storeName, 'readwrite', store => store.delete(id)),

        setConfig: async (key, value) => {
            await tx(CONFIG.STORES.CONFIG, 'readwrite', store => store.put({ key, value }));
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

    // --- 4. UTILIDADES ---
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

    // --- 5. SISTEMA DE TEMA AUTOMÁTICO ---
    async function applyThemeGlobal() {
        try {
            const config = await CRUD.getAllConfig();
            const root = document.documentElement;

            if (config.accentColor) root.style.setProperty('--accent-blue', config.accentColor);
            
            if (config.enableBlur === false) { 
                root.style.setProperty('--card-bg', '#1c1c1e'); 
                root.style.setProperty('--blur-strength', '0px');
            } else {
                root.style.setProperty('--card-bg', 'linear-gradient(180deg, rgba(32, 32, 35, 0.65) 0%, rgba(22, 22, 24, 0.75) 100%)');
                root.style.setProperty('--blur-strength', '40px');
            }
        } catch (e) { console.log("Init Theme..."); }
    }

    // --- 6. LIMPIEZA AUTOMÁTICA (00:00) ---
    async function runDailyCleanup() {
        try {
            const todayStr = new Date().toDateString();
            const lastCleanup = await CRUD.getConfig('lastCleanupDate');

            if (lastCleanup === todayStr) return; // Ya se limpió hoy

            console.log("🧹 Ejecutando limpieza diaria de tareas sueltas...");
            let cleanedCount = 0;

            // 1. Limpiar Store 'TAREAS' (Tareas sueltas)
            const tasks = await CRUD.read(CONFIG.STORES.TAREAS);
            for (const t of tasks) {
                if (t.done === true) { 
                    await CRUD.delete(CONFIG.STORES.TAREAS, t.id);
                    cleanedCount++;
                }
            }

            // 2. Limpiar Store 'INBOX' (Si usaste el inbox.html)
            const inboxItems = await CRUD.read(CONFIG.STORES.INBOX);
            for (const item of inboxItems) {
                if (item.processed === true) {
                    await CRUD.delete(CONFIG.STORES.INBOX, item.id);
                    cleanedCount++;
                }
            }

            // NOTA: NO tocamos el store 'PROYECTOS'. Las tareas dentro de proyectos se quedan.

            await CRUD.setConfig('lastCleanupDate', todayStr);

            if (cleanedCount > 0) {
                showToast(`Limpieza: ${cleanedCount} tareas sueltas borradas`, 'success');
            }

        } catch (e) {
            console.error("Error en limpieza diaria:", e);
        }
    }

    // Inicializar
    initDB();

    return {
        STORES: CONFIG.STORES,
        init: initDB,
        ...CRUD,
        toast: showToast,
        refreshTheme: applyThemeGlobal
    };

})();

window.App = App;