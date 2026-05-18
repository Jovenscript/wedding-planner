/**
 * Wedding Planner SaaS - Core Logic
 * Firebase V10 (Auth + Firestore) configurado com suas chaves reais
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAsW2-Mu3u7SGRJMDtgvtvmI0JkCIi2QgI",
    authDomain: "widding-planner.firebaseapp.com",
    projectId: "widding-planner",
    storageBucket: "widding-planner.firebasestorage.app",
    messagingSenderId: "769857893910",
    appId: "1:769857893910:web:5c6cd69609c74638b26737"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const WEDDING_DOC_ID = "casamento_caroline_marlon"; 

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

const AppState = {
    async save() {
        try {
            await setDoc(doc(db, "weddings", WEDDING_DOC_ID), appData);
            app.renderAll();
        } catch (e) {
            console.error("Erro ao salvar no Firebase:", e);
            if(e.code !== 'permission-denied') {
                Swal.fire('Erro de Nuvem', 'Problemas ao salvar dados.', 'error');
            }
        }
    },
    listen() {
        onSnapshot(doc(db, "weddings", WEDDING_DOC_ID), (document) => {
            if (document.exists()) {
                appData = document.data();
                if(!appData.settings.nextRaffleNumber) appData.settings.nextRaffleNumber = 1;
                app.renderAll();
            } else {
                this.save();
            }
        });
    }
};

const app = {
    init() {
        this.setupNavigation();
        document.getElementById('cfg-names').value = appData.settings.noivos;
        document.getElementById('cfg-date').value = appData.settings.dataCasamento;
    },

    setupAuth() {
        const loginForm = document.getElementById('login-form');
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-password').value;
            
            Swal.fire({ title: 'Autenticando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            try {
                await signInWithEmailAndPassword(auth, email, pass);
                Swal.close();
            } catch (error) {
                Swal.fire('Acesso Negado', 'E-mail ou senha incorretos.', 'error');
            }
        });

        onAuthStateChanged(auth, (user) => {
            if (user) {
                document.getElementById('login-screen').classList.add('hidden');
                document.querySelectorAll('.hidden-app').forEach(el => el.classList.remove('hidden-app'));
                AppState.listen();
                this.init();
            } else {
                document.getElementById('login-screen').classList.remove('hidden');
                document.querySelectorAll('.hidden-app').forEach(el => el.classList.add('hidden-app'));
            }
        });
    },

    async logout() { await signOut(auth); },

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

    async vincularContatoCelular(familyId) {
        if ('contacts' in navigator && 'ContactsManager' in window) {
            try {
                const props = ['name', 'tel']; const opts = { multiple: false };
                const contacts = await navigator.contacts.select(props, opts);
                if (contacts.length > 0 && contacts[0].tel.length > 0) {
                    const phoneClean = contacts[0].tel[0].replace(/\D/g, ''); 
                    const fam = appData.families.find(f => f.id === familyId);
                    if(fam) { fam.phone = phoneClean; AppState.save(); Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `Contato vinculado!`, showConfirmButton: false, timer: 2000 }); }
                } else { Swal.fire('Aviso', 'O contato selecionado não possui um número.', 'info'); }
            } catch (ex) { console.log("Erro Contact Picker:", ex); }
        } else {
            const fam = appData.families.find(f => f.id === familyId);
            const { value: manualPhone } = await Swal.fire({
                title: 'Vincular Número', text: 'Seu navegador não suporta puxar a agenda. Digite o número com DDD:',
                input: 'number', inputPlaceholder: 'Ex: 47999999999', inputValue: fam.phone || ''
            });
            if(manualPhone) { fam.phone = manualPhone.replace(/\D/g, ''); AppState.save(); Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Salvo com sucesso!', showConfirmButton: false, timer: 1500 }); }
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
                            <button onclick="app.vincularContatoCelular('${f.id}')" class="${hasPhone ? 'text-green-500 bg-green-50' : 'text-blue-500 bg-blue-50'} px-2 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 hover:scale-105" title="Abrir agenda do celular">
                                <i class="fa-solid ${hasPhone ? 'fa-address-book' : 'fa-mobile-screen'}"></i> ${hasPhone ? 'Atualizar' : 'Vincular'}
                            </button>
                            <button onclick="app.deleteFamily('${f.id}')" class="text-gray-400 hover:text-red-500 p-1.5 transition"><i class="fa-solid fa-trash text-sm"></i></button>
                        </div>
                    </div>
                    ${hasPhone ? `<div class="text-[10px] text-green-600 font-bold mb-2 break-all"><i class="fa-brands fa-whatsapp mr-1"></i> ${f.phone}</div>` : ''}
                    <div class="flex gap-2 mb-4 text-[10px] uppercase font-bold tracking-wider">
                        <span class="bg-gray-100 px-2 py-1 rounded text-gray-600">Pessoas: ${totalPessoas}</span>
                        ${statusCount.confirmed > 0 ? `<span class="bg-green-100 text-green-700 px-2 py-1 rounded">Conf: ${statusCount.confirmed}</span>` : ''}
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

    enhanceMessageAI() {
        const draftInput = document.getElementById('msg-draft'); const draft = draftInput.value.trim();
        if(!draft) return Swal.fire('Aviso', 'Escreva algo para a IA melhorar!', 'warning');
        Swal.fire({ title: '✨ IA Analisando...', text: 'Melhorando tom e gramática...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        setTimeout(() => {
            let improved = draft;
            if(!improved.includes('[Familia]')) improved = `Olá, família [Familia]! ✨\n\n` + improved;
            improved = improved.charAt(0).toUpperCase() + improved.slice(1);
            if(!improved.toLowerCase().includes('com carinho') && !improved.toLowerCase().includes('abraços')) { improved += `\n\nCom carinho,\nEquipe de Cerimonial - ${appData.settings.noivos} 🥂`; }
            draftInput.value = ''; Swal.close();
            let i = 0;
            const typeWriter = setInterval(() => {
                draftInput.value += improved.charAt(i); i++;
                if (i >= improved.length) { clearInterval(typeWriter); confetti({ particleCount: 50, origin: { y: 0.8 }, colors: ['#D4AF37', '#FBBF24'] }); }
            }, 10);
        }, 1500);
    },

    buildMessageQueue() {
        const draft = document.getElementById('msg-draft').value.trim();
        if(!draft) return Swal.fire('Erro', 'A mensagem não pode estar vazia.', 'error');
        const listContainer = document.getElementById('message-queue-list'); listContainer.innerHTML = '';
        let familiasComCapitao = 0;

        appData.families.forEach(f => {
            if(f.phone && f.phone.length >= 8) {
                familiasComCapitao++;
                const finalMsg = draft.replace(/\[Familia\]/g, f.name);
                const wpLink = `https://wa.me/55${f.phone}?text=${encodeURIComponent(finalMsg)}`;
                listContainer.innerHTML += `
                    <li class="p-4 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50 transition">
                        <div><div class="font-bold text-dark text-sm">${f.name}</div><div class="text-[10px] text-gray-500"><i class="fa-brands fa-whatsapp text-green-500"></i> ${f.phone}</div></div>
                        <a href="${wpLink}" target="_blank" onclick="app.markAsSent(this)" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-2">
                            <i class="fa-brands fa-whatsapp text-lg"></i> Enviar
                        </a>
                    </li>
                `;
            }
        });
        if(familiasComCapitao === 0) listContainer.innerHTML = `<li class="p-4 text-center text-red-500 text-sm">Nenhuma família possui telefone vinculado.</li>`;
        else Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Fila gerada!', showConfirmButton: false, timer: 3000 });
    },

    markAsSent(btnElement) {
        btnElement.classList.remove('bg-green-500', 'hover:bg-green-600'); btnElement.classList.add('bg-gray-200', 'text-gray-500');
        btnElement.innerHTML = `<i class="fa-solid fa-check text-lg"></i> Enviado`;
    },

    generateId() { return Math.random().toString(36).substr(2, 9); },
    openFabMenu() {
        Swal.fire({
            title: 'Ação Rápida', showCancelButton: true, showDenyButton: true,
            confirmButtonText: '<i class="fa-solid fa-user-plus"></i> Convidado', denyButtonText: '<i class="fa-solid fa-wallet"></i> Gasto', cancelButtonText: '<i class="fa-solid fa-people-roof"></i> Família',
            customClass: { confirmButton: 'bg-gold text-white', denyButton: 'bg-dark text-white', cancelButton: 'bg-gray-200 text-dark' }
        }).then((result) => {
            if (result.isConfirmed) this.addGuestModal(); else if (result.isDenied) this.addExpenseModal(); else if (result.dismiss === Swal.DismissReason.cancel) this.addFamilyModal();
        });
    },
    async addFamilyModal() { const { value: name } = await Swal.fire({ title: 'Nova Família', input: 'text', showCancelButton: true }); if (name) { appData.families.push({ id: this.generateId(), name: name, phone: '' }); AppState.save(); } },
    deleteFamily(id) { Swal.fire({ title: 'Excluir família?', text: "Convidados ficarão avulsos.", icon: 'warning', showCancelButton: true }).then((r) => { if (r.isConfirmed) { appData.guests.filter(g => g.familyId === id).forEach(g => g.familyId = null); appData.families = appData.families.filter(f => f.id !== id); AppState.save(); } }); },
    async addGuestModal() {
        const { value: f } = await Swal.fire({
            title: 'Novo Convidado', html: `<input id="swal-g-name" class="swal2-input" placeholder="Nome Completo"><input id="swal-g-acomp" type="number" class="swal2-input" placeholder="Qtd. Acompanhantes (Padrão: 0)">`,
            focusConfirm: false, showCancelButton: true, preConfirm: () => [ document.getElementById('swal-g-name').value.replace(/\b\w/g, l => l.toUpperCase()), parseInt(document.getElementById('swal-g-acomp').value) || 0 ]
        });
        if (f && f[0]) { appData.guests.push({ id: this.generateId(), name: f[0], companions: f[1], status: 'pending', familyId: null }); AppState.save(); }
    },
    async editGuestModal(id) {
        const g = appData.guests.find(x => x.id === id);
        const { value: f } = await Swal.fire({
            title: 'Editar Convidado', html: `<input id="swal-e-name" class="swal2-input" value="${g.name}"><input id="swal-e-acomp" type="number" class="swal2-input" placeholder="Acompanhantes" value="${g.companions || 0}"><select id="swal-e-status" class="swal2-select"><option value="pending" ${g.status==='pending'?'selected':''}>Pendente</option><option value="confirmed" ${g.status==='confirmed'?'selected':''}>Confirmado</option><option value="declined" ${g.status==='declined'?'selected':''}>Recusado</option></select>`,
            focusConfirm: false, showCancelButton: true, preConfirm: () => [ document.getElementById('swal-e-name').value, document.getElementById('swal-e-acomp').value, document.getElementById('swal-e-status').value ]
        });
        if (f) { g.name = f[0]; g.companions = parseInt(f[1])||0; g.status = f[2]; AppState.save(); }
    },
    deleteGuest(id) { appData.guests = appData.guests.filter(g => g.id !== id); AppState.save(); },

    async addExpenseModal() {
        const { value: f } = await Swal.fire({ title: 'Novo Gasto', html: `<input id="swal-ex-name" class="swal2-input" placeholder="Descrição"><input id="swal-ex-cat" class="swal2-input" placeholder="Categoria"><input id="swal-ex-amount" type="number" class="swal2-input" placeholder="Valor Total">`, focusConfirm: false, showCancelButton: true, preConfirm: () => [ document.getElementById('swal-ex-name').value, document.getElementById('swal-ex-cat').value, document.getElementById('swal-ex-amount').value ] });
        if (f && f[0] && f[2]) { appData.expenses.push({ id: this.generateId(), name: f[0], category: f[1] || 'Geral', amount: parseFloat(f[2]), paidAmount: 0 }); AppState.save(); }
    },
    async payExpenseModal(id) { const e = appData.expenses.find(x => x.id === id); const { value: val } = await Swal.fire({ title: 'Pagamento', input: 'number', inputLabel: `Restante: R$ ${(e.amount - e.paidAmount).toFixed(2)}`, showCancelButton: true }); if (val) { e.paidAmount += parseFloat(val); if(e.paidAmount > e.amount) e.paidAmount = e.amount; AppState.save(); confetti({ particleCount: 50, colors: ['#22c55e'] }); } },
    deleteExpense(id) { appData.expenses = appData.expenses.filter(e => e.id !== id); AppState.save(); },
    async addTaskModal() { const { value: t } = await Swal.fire({ title: 'Nova Tarefa', input: 'text', showCancelButton: true }); if (t) { appData.tasks.push({ id: this.generateId(), title: t, done: false }); AppState.save(); } },
    toggleTask(id) { const t = appData.tasks.find(x => x.id === id); if(t) { t.done = !t.done; if(t.done) confetti(); AppState.save(); } },
    deleteTask(id) { appData.tasks = appData.tasks.filter(t => t.id !== id); AppState.save(); },

    importExcel(event) {
        const file = event.target.files[0]; if (!file) return;
        Swal.fire({ title: 'Analisando Excel...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const workbook = XLSX.read(new Uint8Array(e.target.result), {type: 'array'});
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {header: 1}); 
                let headRow = -1, colNome = -1, colFam = -1;
                for(let i = 0; i < Math.min(10, jsonData.length); i++) {
                    const row = jsonData[i] || [];
                    for(let j = 0; j < row.length; j++) {
                        const cell = String(row[j]).toLowerCase().trim();
                        if(cell.includes('nome')) colNome = j;
                        if(cell.includes('família') || cell.includes('familia')) colFam = j;
                    }
                    if(colNome !== -1) { headRow = i; break; }
                }
                if(headRow === -1 || colNome === -1) return Swal.fire('Erro', 'Coluna "Nome" não encontrada.', 'error');
                for(let i = headRow + 1; i < jsonData.length; i++) {
                    if(!jsonData[i] || !jsonData[i][colNome]) continue; 
                    const gName = String(jsonData[i][colNome]).trim();
                    const fName = colFam !== -1 && jsonData[i][colFam] ? String(jsonData[i][colFam]).trim() : null;
                    let fId = null;
                    if (fName) {
                        let fam = appData.families.find(f => f.name.toLowerCase() === fName.toLowerCase());
                        if (!fam) { fam = { id: this.generateId(), name: fName, phone: '' }; appData.families.push(fam); }
                        fId = fam.id;
                    }
                    if (!appData.guests.find(g => g.name.toLowerCase() === gName.toLowerCase())) {
                        appData.guests.push({ id: this.generateId(), name: gName, companions: 0, status: 'pending', familyId: fId });
                    }
                }
                AppState.save(); Swal.fire('Sucesso', 'Excel importado e salvo na nuvem.', 'success');
            } catch (error) { Swal.fire('Erro', error.message, 'error'); }
        };
        reader.readAsArrayBuffer(file); event.target.value = ''; 
    },
    saveConfig() { appData.settings.noivos = document.getElementById('cfg-names').value; appData.settings.dataCasamento = document.getElementById('cfg-date').value; AppState.save(); Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Salvo!', showConfirmButton: false, timer: 1500 }); },
    
    updateTinderBadge() { const p = appData.guests.filter(g => g.status === 'pending').length; const b = document.getElementById('tinder-badge'); if(p > 0) { b.innerText = p; b.classList.remove('hidden'); } else { b.classList.add('hidden'); } },
    renderTinderDeck() {
        const deck = document.getElementById('tinder-deck'); deck.querySelectorAll('.tinder-card').forEach(c => c.remove());
        const pendentes = appData.guests.filter(g => g.status === 'pending');
        if (pendentes.length === 0) { document.getElementById('tinder-empty').style.display = 'flex'; return; }
        document.getElementById('tinder-empty').style.display = 'none';
        [...pendentes].reverse().forEach((g, index) => {
            const fName = g.familyId ? appData.families.find(f => f.id === g.familyId)?.name : 'Avulso';
            const card = document.createElement('div'); card.className = 'tinder-card'; card.dataset.id = g.id;
            card.style.transform = `translateY(-${(pendentes.length - 1 - index) * 5}px) scale(${1 - ((pendentes.length - 1 - index) * 0.02)})`; card.style.zIndex = index + 1;
            card.innerHTML = `<div class="text-xs uppercase tracking-widest text-gold mb-2 font-bold">${fName}</div><h3 class="text-3xl font-serif font-bold text-dark mb-2 leading-tight">${g.name}</h3>`;
            deck.appendChild(card);
        });
    },
    tinderAction(action) {
        const cards = document.getElementById('tinder-deck').querySelectorAll('.tinder-card'); if (cards.length === 0) return;
        const topCard = cards[cards.length - 1]; const guest = appData.guests.find(g => g.id === topCard.dataset.id);
        if(action === 'confirm') { topCard.style.transform = 'translate(150%, -50px) rotate(30deg)'; guest.status = 'confirmed'; confetti({ origin: { y: 0.6 } }); } else { topCard.style.transform = 'translate(-150%, -50px) rotate(-30deg)'; guest.status = 'declined'; }
        topCard.style.opacity = '0'; setTimeout(() => { AppState.save(); }, 300);
    },

    renderExpenses() { document.getElementById('expenses-list').innerHTML = appData.expenses.map(e => `<tr class="hover:bg-gray-50"><td class="p-4 font-medium">${e.name}</td><td class="p-4 text-gray-500">${e.category}</td><td class="p-4 font-semibold">R$ ${e.amount}</td><td class="p-4">${e.paidAmount}</td><td class="p-4 text-right"><button onclick="app.payExpenseModal('${e.id}')" class="text-green-600 p-2"><i class="fa-solid fa-money-bill-wave"></i></button><button onclick="app.deleteExpense('${e.id}')" class="text-red-400 p-2"><i class="fa-solid fa-trash"></i></button></td></tr>`).join(''); },
    renderRifa() {
        const total = appData.rifa.reduce((acc, curr) => acc + parseFloat(curr.amount), 0); const meta = appData.settings.metaRifa || 5000; const perc = Math.min(100, (total / meta) * 100);
        document.getElementById('rifa-current').innerText = `R$ ${total}`; document.getElementById('rifa-goal').innerText = `R$ ${meta}`; document.getElementById('rifa-progress').style.width = `${perc}%`;
        document.getElementById('rifa-list').innerHTML = [...appData.rifa].reverse().map(r => `<li class="p-4 border rounded-xl shadow-sm"><div class="font-bold text-sm">${appData.families.find(f => f.id === r.familyId)?.name || 'Avulso'} comprou ${r.numbers.length} números.</div></li>`).join('');
    },
    async addRifaModal() {
        const fams = appData.families.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
        const { value: f } = await Swal.fire({ title: 'Vender Rifa', html: `<select id="swal-r-fam" class="swal2-select">${fams}</select><input id="swal-r-amt" type="number" class="swal2-input" placeholder="Valor (R$)"><input id="swal-r-qtd" type="number" class="swal2-input" placeholder="Qtd">`, preConfirm: () => [document.getElementById('swal-r-fam').value, document.getElementById('swal-r-amt').value, document.getElementById('swal-r-qtd').value] });
        if (f) { const nums = []; for(let i=0; i<f[2]; i++) nums.push(appData.settings.nextRaffleNumber++); appData.rifa.push({ id: this.generateId(), familyId: f[0], amount: f[1], numbers: nums }); AppState.save(); confetti(); }
    },
    realizarSorteio() {
        const todos = []; appData.rifa.forEach(r => r.numbers.forEach(n => todos.push({ num: n, fam: r.familyId })));
        if(todos.length === 0) return Swal.fire('Aviso', 'Nenhum número vendido.', 'warning');
        const v = todos[Math.floor(Math.random() * todos.length)];
        Swal.fire({ title: 'Ganhador!', html: `<div class="text-4xl text-gold font-bold my-4">Nº ${v.num}</div><div class="text-lg">Família: ${appData.families.find(f=>f.id===v.fam)?.name}</div>`, icon: 'success' });
    }
};

window.app = app;

document.addEventListener('DOMContentLoaded', () => {
    app.setupAuth();
});