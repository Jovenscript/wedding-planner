/**
 * Wedding Planner SaaS - Core Engine
 * Arquitetura Multiusuário Real com Firebase Compat CDN
 */

// ==========================================
// 1. CONFIGURAÇÃO DO SEU BANCO DE DADOS (FIREBASE)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAsW2-Mu3u7SGRJMDtgvtvmI0JkCIi2QgI",
    authDomain: "widding-planner.firebaseapp.com",
    projectId: "widding-planner",
    storageBucket: "widding-planner.firebasestorage.app",
    messagingSenderId: "769857893910",
    appId: "1:769857893910:web:5c6cd69609c74638b26737"
};

// Inicialização segura baseada no estado das chaves
const isFirebaseConfigured = firebaseConfig.apiKey !== "SUA_API_KEY";
if (isFirebaseConfigured) {
    firebase.initializeApp(firebaseConfig);
}

const auth = isFirebaseConfigured ? firebase.auth() : null;
const db = isFirebaseConfigured ? firebase.firestore() : null;

// ==========================================
// 2. ESTADO INICIAL COMPLETO (SaaS TEMPLATE)
// ==========================================
const defaultState = {
    settings: { noivos: "Caroline & Marlon", dataCasamento: "2026-08-29", metaRifa: 5000, nextRaffleNumber: 1 },
    families: [{ id: 'fam_ilton_sonia', name: 'Ilton e Sonia', phone: '' }],
    guests: [
        { id: 'g1', name: 'Ilton', phone: '', companions: 0, status: 'confirmed', familyId: 'fam_ilton_sonia' },
        { id: 'g2', name: 'Sonia', phone: '', companions: 0, status: 'confirmed', familyId: 'fam_ilton_sonia' }
    ],
    expenses: [], tasks: [], rifa: []
};

let appData = JSON.parse(JSON.stringify(defaultState));
let financeChartInstance = null;
let currentUserId = null; // UID do Firebase que dita a pasta exclusiva do cliente

const AppState = {
    save() {
        if(!isFirebaseConfigured) {
            localStorage.setItem('weddingLocalDemoData', JSON.stringify(appData));
            app.renderAll();
            return;
        }
        if(!currentUserId) return;
        db.collection("weddings").doc(currentUserId).set(appData)
            .then(() => app.renderAll())
            .catch((e) => console.error("Erro ao sincronizar nuvem:", e));
    },
    listen(uid) {
        if(!isFirebaseConfigured) {
            const localData = localStorage.getItem('weddingLocalDemoData');
            if(localData) appData = JSON.parse(localData);
            app.renderAll();
            return;
        }
        db.collection("weddings").doc(uid).onSnapshot((doc) => {
            if (doc.exists) {
                appData = doc.data();
                if(!appData.settings.nextRaffleNumber) appData.settings.nextRaffleNumber = 1;
                app.renderAll();
            } else {
                this.save(); // Se for o primeiro acesso da conta, gera o modelo padrão
            }
        });
    }
};

// ==========================================
// 3. REGRAS DE NEGÓCIO E INTERFACES
// ==========================================
const app = {
    isLoginMode: true,

    init() {
        this.setupNavigation();
        document.getElementById('cfg-names').value = appData.settings.noivos;
        document.getElementById('cfg-date').value = appData.settings.dataCasamento;
        this.renderAll();
    },

    toggleAuthMode() {
        this.isLoginMode = !this.isLoginMode;
        document.getElementById('auth-title').innerText = this.isLoginMode ? 'Acesse sua conta' : 'Crie sua conta SaaS';
        document.getElementById('auth-btn').innerHTML = this.isLoginMode ? 'Entrar <i class="fa-solid fa-arrow-right"></i>' : 'Cadastrar <i class="fa-solid fa-user-plus"></i>';
        document.getElementById('auth-toggle-text').innerText = this.isLoginMode ? 'Não tem uma conta?' : 'Já possui uma conta?';
        document.getElementById('auth-toggle-btn').innerText = this.isLoginMode ? 'Criar agora' : 'Fazer Login';
    },

    setupAuth() {
        const authForm = document.getElementById('auth-form');
        authForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            if(!isFirebaseConfigured) {
                Swal.fire('Modo Demonstração', 'Executando em sandbox offline local. Seus dados serão persistidos no navegador local para testes rápidos!', 'info');
                document.getElementById('login-screen').classList.add('hidden');
                document.querySelectorAll('.hidden-app').forEach(el => el.classList.remove('hidden-app'));
                document.getElementById('cloud-status-text').innerHTML = `<i class="fa-solid fa-triangle-exclamation text-yellow-500 mr-1"></i> Modo Local Demo`;
                AppState.listen(null);
                this.init();
                return;
            }

            const email = document.getElementById('auth-email').value;
            const pass = document.getElementById('auth-password').value;
            Swal.fire({ title: 'Processando credenciais...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            
            if(this.isLoginMode) {
                auth.signInWithEmailAndPassword(email, pass).then(() => Swal.close()).catch(() => Swal.fire('Erro', 'Usuário ou senha incorretos.', 'error'));
            } else {
                auth.createUserWithEmailAndPassword(email, pass).then(() => Swal.close()).catch((err) => Swal.fire('Erro de Registro', err.message, 'error'));
            }
        });

        if(isFirebaseConfigured) {
            auth.onAuthStateChanged((user) => {
                if (user) {
                    currentUserId = user.uid;
                    document.getElementById('user-email-display').innerText = user.email;
                    document.getElementById('login-screen').classList.add('hidden');
                    document.querySelectorAll('.hidden-app').forEach(el => el.classList.remove('hidden-app'));
                    AppState.listen(currentUserId);
                    this.init();
                } else {
                    currentUserId = null;
                    document.getElementById('login-screen').classList.remove('hidden');
                    document.querySelectorAll('.hidden-app').forEach(el => el.classList.add('hidden-app'));
                }
            });
        }
    },

    logout() {
        if(!isFirebaseConfigured) { location.reload(); return; }
        auth.signOut();
    },

    renderAll() {
        this.renderHeader(); this.renderDashboard(); this.renderGuests();
        this.renderExpenses(); this.renderRifa(); this.renderTinderDeck();
        this.updateTinderBadge();
    },

    setupNavigation() {
        const hash = window.location.hash.replace('#', '') || 'dashboard';
        this.navigate(hash);
    },
    navigate(viewId) {
        document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active', 'flex'));
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.nav-btn').forEach(el => { el.classList.remove('text-gold', 'bg-blush'); el.classList.add('text-gray-500'); });
        const targetEl = document.getElementById(`view-${viewId}`);
        if(targetEl) { targetEl.classList.remove('hidden'); if(viewId === 'tinder') targetEl.classList.add('flex'); else targetEl.classList.add('active'); }
        const navBtn = document.querySelector(`.nav-btn[data-target="${viewId}"]`);
        if(navBtn) { navBtn.classList.remove('text-gray-500'); navBtn.classList.add('text-gold', 'bg-blush'); }
        window.location.hash = viewId;
        if(viewId === 'dashboard') this.renderDashboard();
    },

    renderHeader() {
        document.getElementById('couple-name').innerText = appData.settings.noivos;
        const dataCasamento = new Date(appData.settings.dataCasamento); const hoje = new Date();
        const dias = Math.ceil((dataCasamento.getTime() - hoje.getTime()) / (1000 * 3600 * 24));
        document.getElementById('countdown').innerHTML = `<i class="fa-regular fa-clock"></i> Faltam ${dias > 0 ? dias : 0} dias`;
        
        // IA Assistant Premium Insights
        const pendentes = appData.guests.filter(g => g.status === 'pending').length;
        const sug = document.getElementById('ai-suggestion');
        if(pendentes > 0) sug.innerHTML = `Identifiquei <b>${pendentes} confirmações pendentes</b>. Vá na aba "Avisos" para disparar a fila de cobrança ou use o RSVP Tinder!`;
        else sug.innerHTML = `Tudo perfeito por aqui! Checklist e confirmações em dia.`;
    },

    renderDashboard() {
        const totalGuests = appData.guests.length + appData.guests.reduce((acc, g) => acc + (g.companions || 0), 0);
        const confirmedGuests = appData.guests.filter(g => g.status === 'confirmed').length + appData.guests.filter(g => g.status === 'confirmed').reduce((acc, g) => acc + (g.companions || 0), 0);
        document.getElementById('dash-guests-count').innerText = `${confirmedGuests}/${totalGuests}`;
        document.getElementById('dash-rsvp-count').innerText = `${confirmedGuests} Confirmados`;

        const totalCost = appData.expenses.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
        document.getElementById('dash-budget').innerText = `R$ ${totalCost.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

        const totalTasks = appData.tasks.length; const doneTasks = appData.tasks.filter(t => t.done).length;
        const taskProgress = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);
        document.getElementById('dash-tasks').innerText = `${taskProgress}%`;
        document.getElementById('dash-tasks-bar').style.width = `${taskProgress}%`;

        document.getElementById('urgent-tasks-list').innerHTML = appData.tasks.map(t => `
            <li class="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 shadow-sm cursor-pointer hover:bg-gray-50" onclick="app.toggleTask('${t.id}')">
                <div class="flex items-center gap-3">
                    <div class="w-5 h-5 rounded border ${t.done ? 'bg-gold border-gold text-white' : 'border-gray-300'} flex items-center justify-center text-xs">${t.done ? '<i class="fa-solid fa-check"></i>' : ''}</div>
                    <span class="text-sm ${t.done ? 'line-through text-gray-400' : 'text-gray-700 font-medium'}">${t.title}</span>
                </div>
                <button onclick="event.stopPropagation(); app.deleteTask('${t.id}')" class="text-gray-300 hover:text-red-500 transition"><i class="fa-solid fa-trash text-xs"></i></button>
            </li>
        `).join('');

        const ctx = document.getElementById('financeChart');
        if(ctx) {
            if(financeChartInstance) financeChartInstance.destroy();
            const categorias = {};
            appData.expenses.forEach(e => { categorias[e.category] = (categorias[e.category] || 0) + parseFloat(e.amount); });
            financeChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: { labels: Object.keys(categorias).length ? Object.keys(categorias) : ['Sem dados'], datasets: [{ data: Object.values(categorias).length ? Object.values(categorias) : [1], backgroundColor: ['#D4AF37', '#F8E8E8', '#333333', '#9CA3AF', '#FBBF24'], borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right' } } }
            });
        }
    },

    // --- CONTACT PICKER API NATIVA (ANDROID/CHROME) ---
    async vincularContatoCelular(familyId) {
        if ('contacts' in navigator && 'ContactsManager' in window) {
            try {
                const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: false });
                if (contacts.length > 0 && contacts[0].tel.length > 0) {
                    const fam = appData.families.find(f => f.id === familyId);
                    if(fam) { fam.phone = contacts[0].tel[0].replace(/\D/g, ''); AppState.save(); }
                }
            } catch (ex) { console.log(ex); }
        } else {
            const fam = appData.families.find(f => f.id === familyId);
            const { value: manualPhone } = await Swal.fire({ title: 'Vincular WhatsApp', text: 'Insira o número com o DDD:', input: 'number', inputValue: fam.phone || '' });
            if(manualPhone) { fam.phone = manualPhone.replace(/\D/g, ''); AppState.save(); }
        }
    },

    renderGuests() {
        const unassignedContainer = document.getElementById('unassigned-guests');
        const familiesContainer = document.getElementById('families-grid');
        unassignedContainer.innerHTML = ''; familiesContainer.innerHTML = '';

        const avulsos = appData.guests.filter(g => !g.familyId);
        if(avulsos.length === 0) unassignedContainer.innerHTML = '<span class="text-xs text-gray-400 italic">Nenhum convidado avulso.</span>';
        avulsos.forEach(g => { unassignedContainer.innerHTML += this.createGuestPill(g); });

        appData.families.forEach(f => {
            const fGuests = appData.guests.filter(g => g.familyId === f.id);
            const statusCount = { pending: 0, confirmed: 0, declined: 0 };
            let totalPessoas = 0;
            fGuests.forEach(g => { statusCount[g.status]++; totalPessoas += 1 + (g.companions || 0); });

            const hasPhone = f.phone && f.phone.length > 8;

            familiesContainer.innerHTML += `
                <div class="glass-card bg-white p-5 rounded-2xl border-t-4 border-gold shadow-sm inline-block w-full break-inside-avoid" ondragover="app.allowDrop(event)" ondrop="app.drop(event, '${f.id}')">
                    <div class="flex justify-between items-start mb-3">
                        <h3 class="font-bold text-dark text-lg">${f.name}</h3>
                        <div class="flex gap-2">
                            <button onclick="app.vincularContatoCelular('${f.id}')" class="${hasPhone ? 'text-green-500 bg-green-50' : 'text-blue-500 bg-blue-50'} px-2 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1" title="Vincular contato da agenda"><i class="fa-solid ${hasPhone ? 'fa-address-book' : 'fa-mobile-screen'}"></i> ${hasPhone ? 'Atualizar' : 'Vincular'}</button>
                            <button onclick="app.deleteFamily('${f.id}')" class="text-gray-400 hover:text-red-500 p-1.5 transition"><i class="fa-solid fa-trash text-sm"></i></button>
                        </div>
                    </div>
                    ${hasPhone ? `<div class="text-[10px] text-green-600 font-bold mb-2 break-all"><i class="fa-brands fa-whatsapp mr-1"></i> ${f.phone}</div>` : ''}
                    <div class="flex gap-2 mb-4 text-[10px] uppercase font-bold tracking-wider">
                        <span class="bg-gray-100 px-2 py-1 rounded text-gray-600">Total Integrantes: ${totalPessoas}</span>
                    </div>
                    <div class="space-y-2 min-h-[40px]" id="family-list-${f.id}">
                        ${fGuests.map(g => this.createGuestPill(g)).join('')}
                    </div>
                </div>
            `;
        });
    },

    createGuestPill(g) {
        const bgColors = { pending: 'bg-white border-gray-200', confirmed: 'bg-green-50 border-green-200', declined: 'bg-red-50 border-red-200' };
        const iconColors = { pending: 'text-gray-400', confirmed: 'text-green-500', declined: 'text-red-500' };
        const acomp = g.companions > 0 ? `<span class="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full ml-1">+${g.companions}</span>` : '';
        return `
            <div id="${g.id}" class="guest-pill flex justify-between items-center px-3 py-2 rounded-xl border shadow-sm ${bgColors[g.status]}" draggable="true" ondragstart="app.drag(event)">
                <div class="flex items-center gap-2 overflow-hidden">
                    <i class="fa-solid fa-circle text-[8px] ${iconColors[g.status]}"></i>
                    <span class="text-sm font-medium text-gray-700 truncate cursor-pointer hover:underline" onclick="app.editGuestModal('${g.id}')">${g.name} ${acomp}</span>
                </div>
                <button onclick="app.deleteGuest('${g.id}')" class="text-gray-300 hover:text-red-500 transition ml-2"><i class="fa-solid fa-xmark text-xs"></i></button>
            </div>
        `;
    },

    allowDrop(ev) { ev.preventDefault(); ev.currentTarget.classList.add('drag-over'); },
    drag(ev) { ev.dataTransfer.setData("text", ev.target.id); },
    drop(ev, familyId) {
        ev.preventDefault(); document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        const guestId = ev.dataTransfer.getData("text"); const guest = appData.guests.find(g => g.id === guestId);
        if(guest) { guest.familyId = familyId; AppState.save(); }
    },

    // --- MENSAGENS E AUTOMAÇÃO INTELEGENTE ---
    enhanceMessageAI() {
        const draftInput = document.getElementById('msg-draft');
        const draft = draftInput.value.trim();
        if(!draft) return Swal.fire('Aviso', 'Escreva algo para a IA lapidar!', 'warning');
        Swal.fire({ title: '✨ Analisando Ortografia e Coerência...', text: 'Formatando mensagem premium...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        setTimeout(() => {
            let improved = draft;
            if(!improved.includes('[Familia]')) improved = `Olá, família [Familia]! ✨\n\n` + improved;
            improved = improved.charAt(0).toUpperCase() + improved.slice(1);
            if(!improved.toLowerCase().includes('com carinho') && !improved.toLowerCase().includes('abraços')) {
                improved += `\n\nContamos com vocês! Com carinho,\nAssessoria de Cerimonial 🥂`;
            }
            draftInput.value = ''; Swal.close();
            let i = 0;
            const typeWriter = setInterval(() => {
                draftInput.value += improved.charAt(i); i++;
                if (i >= improved.length) { clearInterval(typeWriter); confetti({ particleCount: 40, origin: { y: 0.8 } }); }
            }, 8);
        }, 1200);
    },

    buildMessageQueue() {
        const draft = document.getElementById('msg-draft').value.trim();
        if(!draft) return Swal.fire('Erro', 'Escreva a mensagem base antes.', 'error');
        const listContainer = document.getElementById('message-queue-list');
        listContainer.innerHTML = '';
        let count = 0;

        appData.families.forEach(f => {
            if(f.phone && f.phone.length >= 8) {
                count++;
                const finalMsg = draft.replace(/\[Familia\]/g, f.name);
                const wpLink = `https://wa.me/55${f.phone}?text=${encodeURIComponent(finalMsg)}`;
                listContainer.innerHTML += `
                    <li class="p-4 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50 transition">
                        <div><div class="font-bold text-dark text-sm">${f.name}</div><div class="text-[10px] text-gray-500"><i class="fa-brands fa-whatsapp text-green-500"></i> ${f.phone}</div></div>
                        <a href="${wpLink}" target="_blank" onclick="app.markAsSent(this)" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2"><i class="fa-brands fa-whatsapp text-lg"></i> Disparar</a>
                    </li>`;
            }
        });
        if(count === 0) listContainer.innerHTML = `<li class="p-4 text-center text-red-500 text-sm">Vincule números de celular às suas famílias para liberar os disparos.</li>`;
    },
    markAsSent(btn) { btn.className = "bg-gray-200 text-gray-500 px-4 py-2 rounded-xl text-xs font-bold"; btn.innerHTML = `<i class="fa-solid fa-check"></i> Aberto`; },

    // --- SMART IMPORT COMPATÍVEL COM O FORMATO SaaS ---
    importExcel(event) {
        const file = event.target.files[0]; if (!file) return;
        Swal.fire({ title: 'Escaneando Colunas...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const workbook = XLSX.read(new Uint8Array(e.target.result), {type: 'array'});
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {header: 1}); 
                let headRow = -1, colNome = -1, colFam = -1, colAcomp = -1, colStatus = -1;
                
                for(let i = 0; i < Math.min(10, jsonData.length); i++) {
                    const row = jsonData[i] || [];
                    for(let j = 0; j < row.length; j++) {
                        const cell = String(row[j]).toLowerCase().trim();
                        if(cell === 'nome' || cell === 'convidado') colNome = j;
                        if(cell === 'família' || cell === 'familia') colFam = j;
                        if(cell === 'acompanhantes' || cell === 'quantidade') colAcomp = j;
                        if(cell === 'status' || cell === 'confirmação' || cell === 'confirmacao') colStatus = j;
                    }
                    if(colNome !== -1) { headRow = i; break; }
                }
                if(headRow === -1 || colNome === -1) return Swal.fire('Erro', 'Formato incompatível. Coluna "Nome" obrigatória.', 'error');
                
                let countG = 0;
                for(let i = headRow + 1; i < jsonData.length; i++) {
                    const r = jsonData[i]; if(!r || !r[colNome]) continue;
                    const name = String(r[colNome]).trim();
                    const famName = colFam !== -1 && r[colFam] ? String(r[colFam]).trim() : 'Avulso';
                    const acomp = colAcomp !== -1 && r[colAcomp] ? parseInt(r[colAcomp]) || 0 : 0;
                    let st = colStatus !== -1 && r[colStatus] ? String(r[colStatus]).toLowerCase().trim() : 'pending';
                    if(['sim','confirmado','vai'].includes(st)) st = 'confirmed';
                    if(['não','nao','recusado'].includes(st)) st = 'declined';

                    let fam = appData.families.find(f => f.name.toLowerCase() === famName.toLowerCase());
                    if (!fam && famName !== 'Avulso') { fam = { id: this.generateId(), name: famName, phone: '' }; appData.families.push(fam); }
                    
                    if(!appData.guests.find(g => g.name.toLowerCase() === name.toLowerCase())) {
                        appData.guests.push({ id: this.generateId(), name: name, phone: '', companions: acomp, status: st, familyId: fam ? fam.id : null });
                        countG++;
                    }
                }
                AppState.save(); Swal.fire('Sucesso', `${countG} Convidados importados e agrupados com sucesso!`, 'success');
            } catch (err) { Swal.fire('Erro', 'Falha ao processar planilha.', 'error'); }
        };
        reader.readAsArrayBuffer(file); event.target.value = '';
    },

    importFinanceJSON(event) {
        const file = event.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const arr = JSON.parse(e.target.result);
                if(!Array.isArray(arr)) throw new Error("JSON deve ser uma lista de objetos.");
                arr.forEach(i => appData.expenses.push({ id: this.generateId(), name: i.name || i.nome || 'Importado', category: i.category || 'Geral', amount: parseFloat(i.amount || i.valor || 0), paidAmount: parseFloat(i.paidAmount || i.pago || 0) }));
                AppState.save(); Swal.fire('Sucesso', 'Finanças integradas.', 'success');
            } catch(ex) { Swal.fire('Erro', ex.message, 'error'); }
        }; reader.readAsText(file); event.target.value = '';
    },

    // --- CRUD E MÓDULOS DE COMPLEMENTO ---
    generateId() { return Math.random().toString(36).substr(2, 9); },
    openFabMenu() {
        Swal.fire({
            title: 'Ação Rápida', showCancelButton: true, showDenyButton: true,
            confirmButtonText: '<i class="fa-solid fa-user-plus"></i> Convidado', denyButtonText: '<i class="fa-solid fa-wallet"></i> Gasto', cancelButtonText: '<i class="fa-solid fa-people-roof"></i> Família',
            customClass: { confirmButton: 'bg-gold text-white', denyButton: 'bg-dark text-white', cancelButton: 'bg-gray-200 text-dark' }
        }).then((res) => { if (res.isConfirmed) this.addGuestModal(); else if (res.isDenied) this.addExpenseModal(); else if (res.dismiss === Swal.DismissReason.cancel) this.addFamilyModal(); });
    },
    async addFamilyModal() { const { value: n } = await Swal.fire({ title: 'Nova Família', input: 'text', showCancelButton: true }); if (n) { appData.families.push({ id: this.generateId(), name: n, phone: '' }); AppState.save(); } },
    deleteFamily(id) { appData.guests.filter(g => g.familyId === id).forEach(g => g.familyId = null); appData.families = appData.families.filter(f => f.id !== id); AppState.save(); },
    async addGuestModal() {
        const { value: f } = await Swal.fire({ title: 'Adicionar Convidado', html: `<input id="swal-g-name" class="swal2-input" placeholder="Nome"><input id="swal-g-acomp" type="number" class="swal2-input" placeholder="Acompanhantes">`, showCancelButton: true, preConfirm: () => [document.getElementById('swal-g-name').value, parseInt(document.getElementById('swal-g-acomp').value)||0] });
        if(f && f[0]) { appData.guests.push({ id: this.generateId(), name: f[0], companions: f[1], status: 'pending', familyId: null }); AppState.save(); }
    },
    async editGuestModal(id) {
        const g = appData.guests.find(x => x.id === id);
        const { value: f } = await Swal.fire({ title: 'Editar', html: `<input id="swal-e-name" class="swal2-input" value="${g.name}"><input id="swal-e-acomp" type="number" class="swal2-input" value="${g.companions || 0}"><select id="swal-e-status" class="swal2-select"><option value="pending" ${g.status==='pending'?'selected':''}>Pendente</option><option value="confirmed" ${g.status==='confirmed'?'selected':''}>Confirmado</option><option value="declined" ${g.status==='declined'?'selected':''}>Recusado</option></select>`, showCancelButton: true, preConfirm: () => [document.getElementById('swal-e-name').value, parseInt(document.getElementById('swal-e-acomp').value)||0, document.getElementById('swal-e-status').value] });
        if(f) { g.name = f[0]; g.companions = f[1]; g.status = f[2]; AppState.save(); }
    },
    deleteGuest(id) { appData.guests = appData.guests.filter(g => g.id !== id); AppState.save(); },
    async addExpenseModal() {
        const { value: f } = await Swal.fire({ title: 'Novo Gasto', html: `<input id="swal-ex-name" class="swal2-input" placeholder="Item"><input id="swal-ex-cat" class="swal2-input" placeholder="Categoria"><input id="swal-ex-amount" type="number" class="swal2-input" placeholder="Total R$">`, showCancelButton: true, preConfirm: () => [document.getElementById('swal-ex-name').value, document.getElementById('swal-ex-cat').value, parseFloat(document.getElementById('swal-ex-amount').value)||0] });
        if(f && f[0]) { appData.expenses.push({ id: this.generateId(), name: f[0], category: f[1]||'Geral', amount: f[2], paidAmount: 0 }); AppState.save(); }
    },
    async payExpenseModal(id) { const e = appData.expenses.find(x => x.id === id); const { value: v } = await Swal.fire({ title: 'Pagar', input: 'number', inputLabel: `Restante: R$ ${e.amount - e.paidAmount}`, showCancelButton: true }); if(v) { e.paidAmount += parseFloat(v); if(e.paidAmount > e.amount) e.paidAmount = e.amount; AppState.save(); } },
    deleteExpense(id) { appData.expenses = appData.expenses.filter(e => e.id !== id); AppState.save(); },
    async addTaskModal() { const { value: t } = await Swal.fire({ title: 'Nova Tarefa', input: 'text', showCancelButton: true }); if(t) { appData.tasks.push({ id: this.generateId(), title: t, done: false }); AppState.save(); } },
    toggleTask(id) { const t = appData.tasks.find(x => x.id === id); if(t) { t.done = !t.done; AppState.save(); } },
    deleteTask(id) { appData.tasks = appData.tasks.filter(t => t.id !== id); AppState.save(); },

    renderExpenses() { document.getElementById('expenses-list').innerHTML = appData.expenses.map(e => `<tr class="hover:bg-gray-50"><td class="p-4 font-medium">${e.name}</td><td class="p-4 text-gray-500">${e.category}</td><td class="p-4 font-semibold">R$ ${e.amount}</td><td class="p-4">${((e.paidAmount/e.amount)*100 || 0).toFixed(0)}% Pago</td><td class="p-4 text-right"><button onclick="app.payExpenseModal('${e.id}')" class="text-green-600 p-2"><i class="fa-solid fa-money-bill-wave"></i></button><button onclick="app.deleteExpense('${e.id}')" class="text-red-400 p-2"><i class="fa-solid fa-trash"></i></button></td></tr>`).join(''); },
    
    // --- RIFA ORGANIZADA POR FAMÍLIA ÚNICA ---
    renderRifa() {
        const total = appData.rifa.reduce((acc, curr) => acc + parseFloat(curr.amount), 0); const meta = appData.settings.metaRifa || 5000;
        document.getElementById('rifa-current').innerText = `R$ ${total}`; document.getElementById('rifa-goal').innerText = `R$ ${meta}`; document.getElementById('rifa-progress').style.width = `${Math.min(100, (total/meta)*100)}%`;
        document.getElementById('rifa-list').innerHTML = [...appData.rifa].reverse().map(r => {
            const fName = appData.families.find(f => f.id === r.familyId)?.name || 'Avulso';
            return `<li class="p-4 bg-white rounded-xl border flex justify-between items-center shadow-sm"><div><div class="font-bold text-sm"><i class="fa-solid fa-people-roof text-gold mr-1"></i> ${fName}</div><div class="mt-1">${r.numbers.map(n=>`<span class="raffle-ticket">Nº ${n}</span>`).join('')}</div></div><div class="font-bold text-green-600">R$ ${r.amount}</div></li>`;
        }).join('');
    },
    async addRifaModal() {
        const fams = appData.families.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
        const { value: f } = await Swal.fire({ title: 'Vender Rifa', html: `<select id="swal-r-fam" class="swal2-select w-full">${fams}</select><input id="swal-r-amt" type="number" class="swal2-input" placeholder="Valor total arrecadado"><input id="swal-r-qtd" type="number" class="swal2-input" placeholder="Quantidade de números">`, preConfirm: () => [document.getElementById('swal-r-fam').value, parseFloat(document.getElementById('swal-r-amt').value)||0, parseInt(document.getElementById('swal-r-qtd').value)||0] });
        if(f && f[1] > 0) {
            const nums = []; for(let i=0; i<f[2]; i++) nums.push(appData.settings.nextRaffleNumber++);
            appData.rifa.push({ id: this.generateId(), familyId: f[0], amount: f[1], numbers: nums }); AppState.save(); confetti();
        }
    },
    realizarSorteio() {
        const todos = []; appData.rifa.forEach(r => r.numbers.forEach(n => todos.push({ num: n, fam: r.familyId })));
        if(todos.length === 0) return Swal.fire('Aviso', 'Nenhum número vendido.', 'warning');
        const v = todos[Math.floor(Math.random() * todos.length)];
        Swal.fire({ title: 'Ganhador do Prêmio!', html: `<div class="text-5xl text-gold font-bold my-4">Nº ${v.num}</div><div class="text-xl font-semibold">Família: ${appData.families.find(f=>f.id===v.fam)?.name}</div>`, icon: 'success' });
        confetti({ particleCount: 200, spread: 80 });
    },

    // --- RSVP TINDER ---
    updateTinderBadge() { const p = appData.guests.filter(g => g.status === 'pending').length; const b = document.getElementById('tinder-badge'); if(p > 0) { b.innerText = p; b.classList.remove('hidden'); } else { b.classList.add('hidden'); } },
    renderTinderDeck() {
        const deck = document.getElementById('tinder-deck'); deck.querySelectorAll('.tinder-card').forEach(c => c.remove());
        const pendentes = appData.guests.filter(g => g.status === 'pending');
        if (pendentes.length === 0) { document.getElementById('tinder-empty').style.display = 'flex'; return; }
        document.getElementById('tinder-empty').style.display = 'none';
        [...pendentes].reverse().forEach((g, index) => {
            const card = document.createElement('div'); card.className = 'tinder-card'; card.dataset.id = g.id;
            card.style.transform = `translateY(-${(pendentes.length - 1 - index) * 5}px) scale(${1 - ((pendentes.length - 1 - index) * 0.02)})`; card.style.zIndex = index + 1;
            card.innerHTML = `<div class="text-xs uppercase tracking-widest text-gold mb-2 font-bold">${g.familyId ? appData.families.find(f => f.id === g.familyId)?.name : 'Avulso'}</div><h3 class="text-3xl font-serif font-bold text-dark mb-2">${g.name}</h3>`;
            deck.appendChild(card);
        });
    },
    tinderAction(action) {
        const cards = document.getElementById('tinder-deck').querySelectorAll('.tinder-card'); if (cards.length === 0) return;
        const top = cards[cards.length - 1]; const guest = appData.guests.find(g => g.id === top.dataset.id);
        if(action === 'confirm') { top.style.transform = 'translate(150%, -50px) rotate(30deg)'; guest.status = 'confirmed'; confetti(); } 
        else { top.style.transform = 'translate(-150%, -50px) rotate(-30deg)'; guest.status = 'declined'; }
        top.style.opacity = '0'; setTimeout(() => AppState.save(), 250);
    },

    saveConfig() { appData.settings.noivos = document.getElementById('cfg-names').value; appData.settings.dataCasamento = document.getElementById('cfg-date').value; AppState.save(); Swal.fire('Sucesso', 'Nuvem atualizada!', 'success'); }
};

window.app = app;
document.addEventListener('DOMContentLoaded', () => app.setupAuth());
