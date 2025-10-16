// --- IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, query, where, limit, collectionGroup, updateDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-functions.js";

// --- CONFIG AND INITIALIZATION ---
const firebaseConfig = {
    apiKey: "AIzaSyAxyGsVS9cuuv2bkwWKcj3ZgQPzIA5T15w",
    authDomain: "plats-83345.firebaseapp.com",
    projectId: "plats-83345",
    storageBucket: "plats-83345.appspot.com",
    messagingSenderId: "619656775053",
    appId: "1:619656775053:web:25249b178c03afba52e9c4",
    measurementId: "G-WKPK539FW6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

// --- DOM ELEMENTS ---
const loginScreen = document.getElementById('login-screen');
const adminPanel = document.getElementById('admin-panel');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutButton = document.getElementById('logout-button');
const loadingSpinner = document.getElementById('loading-spinner');
const pageTitle = document.getElementById('page-title');

const assignModal = document.getElementById('assign-modal');
const assignModalTitle = document.getElementById('assign-modal-title');
const assignModalContent = document.getElementById('assign-modal-content');
const saveAssignmentBtn = document.getElementById('save-assignment-btn');

const navLinks = {
    dashboard: document.getElementById('nav-dashboard'),
    owners: document.getElementById('nav-owners'),
    managers: document.getElementById('nav-managers'),
    staff: document.getElementById('nav-staff'),
    condos: document.getElementById('nav-condos'),
    reports: document.getElementById('nav-reports'),
};

const contentPages = {
    users: document.getElementById('content-users'),
    condos: document.getElementById('content-condos'),
};

let currentRole = 'OWNER';

// --- UTILITY FUNCTIONS & AUTH ---
const showLoading = () => loadingSpinner.classList.remove('hidden');
const hideLoading = () => loadingSpinner.classList.add('hidden');
const openModal = (modal) => modal.classList.remove('hidden');
const closeModal = (modal) => modal.classList.add('hidden');

function handleFirestoreError(error, contextMessage) {
    console.error(`Error ${contextMessage}:`, error);
    hideLoading();
    alert(`Could not perform action for ${contextMessage}. Check the console for details.`);
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    loginError.textContent = '';
    showLoading();
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        loginError.textContent = 'Login failed. Please check your credentials.';
        hideLoading();
    }
});

logoutButton.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === 'ADMIN') {
            loginScreen.classList.add('hidden');
            adminPanel.classList.remove('hidden');
            
            const pageToLoad = sessionStorage.getItem('loadPage');
            if (pageToLoad && navLinks[pageToLoad]) {
                navLinks[pageToLoad].click();
                sessionStorage.removeItem('loadPage');
            } else {
                loadUsers('OWNER', 'Owners', 'owners');
            }
        } else {
            loginError.textContent = 'Access Denied. Only Admins can log in.';
            await signOut(auth);
        }
    } else {
        loginScreen.classList.remove('hidden');
        adminPanel.classList.add('hidden');
    }
    hideLoading();
});

// --- NAVIGATION & PAGE LOADING ---
function setActiveNav(activeId) {
    Object.values(navLinks).forEach(link => link.classList.remove('bg-gray-700'));
    if (navLinks[activeId]) {
        navLinks[activeId].classList.add('bg-gray-700');
    }
}

function showPage(pageKey) {
    Object.values(contentPages).forEach(page => page.classList.add('hidden'));
    const targetPage = ['owners', 'managers', 'staff'].includes(pageKey) ? 'users' : pageKey;
    if (contentPages[targetPage]) {
        contentPages[targetPage].classList.remove('hidden');
    }
}

navLinks.owners.addEventListener('click', () => { currentRole = 'OWNER'; loadUsers('OWNER', 'Owners', 'owners'); });
navLinks.managers.addEventListener('click', () => { currentRole = 'CONDOMINIUM_MANAGER'; loadUsers('CONDOMINIUM_MANAGER', 'Managers', 'managers'); });
navLinks.staff.addEventListener('click', () => { currentRole = 'STAFF'; loadUsers('STAFF', 'Staff', 'staff'); });
navLinks.condos.addEventListener('click', () => loadCondos());

// ##### ----- DETAILED EXPORT FUNCTIONS ----- #####
async function exportOwnersWithFlats() {
    showLoading();
    try {
        const ownersQuery = query(collection(db, "users"), where("role", "==", "OWNER"));
        const condosQuery = collection(db, "condominiums");
        const [ownersSnapshot, condosSnapshot] = await Promise.all([getDocs(ownersQuery), getDocs(condosQuery)]);
        const flatsByOwnerId = {};
        condosSnapshot.forEach(doc => {
            const flat = doc.data();
            if (flat.ownerId) {
                if (!flatsByOwnerId[flat.ownerId]) flatsByOwnerId[flat.ownerId] = [];
                flatsByOwnerId[flat.ownerId].push({ name: flat.condominiumName || 'N/A', address: flat.address || 'N/A' });
            }
        });
        const csvRows = [];
        const headers = ['Owner Name', 'Email', 'Telephone', 'Flat Name', 'Address'];
        csvRows.push(headers.join(','));
        ownersSnapshot.forEach(ownerDoc => {
            const owner = ownerDoc.data();
            const ownerName = owner.ownerName || 'N/A';
            const ownedFlats = flatsByOwnerId[ownerDoc.id] || [];
            const sanitize = (str) => `"${String(str || '').replace(/"/g, '""')}"`;
            if (ownedFlats.length > 0) {
                ownedFlats.forEach(flat => {
                    const row = [sanitize(ownerName), sanitize(owner.email), sanitize(owner.telephone), sanitize(flat.name), sanitize(flat.address)];
                    csvRows.push(row.join(','));
                });
            } else {
                const row = [sanitize(ownerName), sanitize(owner.email), sanitize(owner.telephone), sanitize('No Flats Assigned'), sanitize('N/A')];
                csvRows.push(row.join(','));
            }
        });
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `owners_and_flats_report.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        handleFirestoreError(error, "exporting owners with flats");
    } finally {
        hideLoading();
    }
}

async function exportManagersWithFlats() {
    showLoading();
    try {
        const managersQuery = query(collection(db, "users"), where("role", "==", "CONDOMINIUM_MANAGER"));
        const managersSnapshot = await getDocs(managersQuery);
        const condosSnapshot = await getDocs(collection(db, "condominiums"));
        const flatAssignments = {};
        condosSnapshot.forEach(doc => {
            const flat = doc.data();
            if (flat.managerUid) {
                flatAssignments[flat.managerUid] = { name: flat.condominiumName || 'N/A', address: flat.address || 'N/A' };
            }
        });
        const csvRows = [];
        const headers = ['Manager Name', 'Email', 'Telephone', 'Assigned Flat', 'Flat Address'];
        csvRows.push(headers.join(','));
        managersSnapshot.forEach(managerDoc => {
            const manager = managerDoc.data();
            const managerName = manager.managerName || 'N/A';
            const assignedFlat = flatAssignments[managerDoc.id];
            const sanitize = (str) => `"${String(str || '').replace(/"/g, '""')}"`;
            const row = [sanitize(managerName), sanitize(manager.email), sanitize(manager.telephone), sanitize(assignedFlat ? assignedFlat.name : 'Not Assigned'), sanitize(assignedFlat ? assignedFlat.address : 'N/A')];
            csvRows.push(row.join(','));
        });
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `managers_and_flats_report.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        handleFirestoreError(error, "exporting managers with flats");
    } finally {
        hideLoading();
    }
}

// --- DATA FETCHING AND RENDERING ---
async function loadUsers(role, title, navKey) {
    setActiveNav(navKey);
    showPage(navKey);
    pageTitle.textContent = title;
    showLoading();
    document.getElementById('export-condos-btn').classList.add('hidden');
    const headerRow = document.getElementById('users-table-header-row');
    const tableBody = document.getElementById('users-table-body');
    const exportBtn = document.getElementById('export-users-btn');
    tableBody.innerHTML = '';
    document.getElementById('user-search').value = '';
    let headers = ['Name', 'Email', 'Telephone'];
    if (role === 'CONDOMINIUM_MANAGER') headers.push('Assigned Flat');
    if (role === 'STAFF') headers.push('Total Points');
    if (role === 'OWNER' || role === 'STAFF') headers.push('Actions');
    headerRow.innerHTML = headers.map(h => `<th class="p-4">${h}</th>`).join('');
    exportBtn.classList.add('hidden');
    if (role === 'OWNER') {
        exportBtn.innerHTML = `<i class="fas fa-file-excel mr-2"></i> Export Owners with Flats`;
        exportBtn.onclick = exportOwnersWithFlats;
        exportBtn.classList.remove('hidden');
    }
    if (role === 'CONDOMINIUM_MANAGER') {
        exportBtn.innerHTML = `<i class="fas fa-file-excel mr-2"></i> Export Managers with Flats`;
        exportBtn.onclick = exportManagersWithFlats;
        exportBtn.classList.remove('hidden');
    }
    try {
        const usersQuery = query(collection(db, "users"), where("role", "==", role));
        const usersSnapshot = await getDocs(usersQuery);
        if (usersSnapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="${headers.length}" class="p-4 text-center text-gray-400">No ${title} found.</td></tr>`;
            hideLoading();
            return;
        }
        let rowsHtmlPromises = usersSnapshot.docs.map(async (userDoc) => {
            const userData = userDoc.data();
            const name = userData.ownerName || userData.managerName || userData.staffName || 'N/A';
            let extraColumnsHtml = '';
            if (role === 'CONDOMINIUM_MANAGER') {
                const condoQuery = query(collection(db, "condominiums"), where("managerUid", "==", userDoc.id), limit(1));
                const condoSnap = await getDocs(condoQuery);
                const assignedFlat = condoSnap.empty ? '<span class="text-gray-500">Not Assigned</span>' : condoSnap.docs[0].data().condominiumName;
                extraColumnsHtml += `<td class="p-4">${assignedFlat}</td>`;
            }
            if (role === 'STAFF') {
                extraColumnsHtml += `<td class="p-4">${userData.totalPoints || 0}</td>`;
            }
            let actionButtonsHtml = '<div class="flex items-center space-x-2">';
            if (role === 'OWNER') {
                actionButtonsHtml += `<button class="view-owner-flats-btn bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded-lg text-sm" data-user-id="${userDoc.id}" data-user-name="${name}">View Flats</button>`;
            }
            if (role === 'STAFF') {
                const staffId = userDoc.id;
                const staffName = encodeURIComponent(name);
                actionButtonsHtml += `<button class="view-staff-flats-btn bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded-lg text-sm" data-user-id="${staffId}" data-user-name="${name}">Flats</button>`;
                actionButtonsHtml += `<button class="view-points-btn bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1 px-3 rounded-lg text-sm" data-user-id="${staffId}" data-user-name="${name}">Points</button>`;
                actionButtonsHtml += `<a href="reviews.html?staffId=${staffId}&staffName=${staffName}" target="_blank" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded-lg text-sm">Info</a>`;
            }
            actionButtonsHtml += '</div>';
            if (actionButtonsHtml !== '<div class="flex items-center space-x-2"></div>') {
                extraColumnsHtml += `<td class="p-4">${actionButtonsHtml}</td>`;
            }
            return `<tr class="hover:bg-gray-700 border-b border-gray-700"><td class="p-4">${name}</td><td class="p-4">${userData.email || 'N/A'}</td><td class="p-4">${userData.telephone || 'N/A'}</td>${extraColumnsHtml}</tr>`;
        });
        const rowsHtml = await Promise.all(rowsHtmlPromises);
        tableBody.innerHTML = rowsHtml.join('');
    } catch (error) {
        handleFirestoreError(error, `loading ${title}`);
        tableBody.innerHTML = `<tr><td colspan="${headers.length}" class="p-4 text-center text-red-500">Error loading data.</td></tr>`;
    } finally {
        hideLoading();
    }
}

async function loadCondos() {
    setActiveNav('condos');
    showPage('condos');
    pageTitle.textContent = 'Flats';
    showLoading();
    document.getElementById('export-users-btn').classList.add('hidden');
    const exportBtn = document.getElementById('export-condos-btn');
    exportBtn.classList.remove('hidden');
    exportBtn.onclick = () => exportTableToCSV('flats.csv', 'condos-table-body', 'condos-table-header-row');
    const tableBody = document.getElementById('condos-table-body');
    const headerRow = document.getElementById('condos-table-header-row');
    tableBody.innerHTML = '';
    headerRow.innerHTML = ['Flat Name', 'Address', 'Owner', 'Manager', 'Actions'].map(h => `<th class="p-4">${h}</th>`).join('');
    try {
        const [condosSnapshot, usersSnapshot] = await Promise.all([getDocs(collection(db, "condominiums")), getDocs(collection(db, "users"))]);
        const usersMap = {};
        usersSnapshot.forEach(doc => usersMap[doc.id] = doc.data());
        if (condosSnapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center">No flats found.</td></tr>`;
            return;
        }
        let rowsHtml = '';
        condosSnapshot.forEach(condoDoc => {
            const condo = condoDoc.data();
            const ownerName = condo.ownerId ? (usersMap[condo.ownerId]?.ownerName || 'Not Assigned') : 'Not Assigned';
            const managerName = condo.managerUid ? (usersMap[condo.managerUid]?.managerName || 'Not Assigned') : 'Not Assigned';
            rowsHtml += `<tr class="hover:bg-gray-700 border-b border-gray-700"><td class="p-4">${condo.condominiumName || 'N/A'}</td><td class="p-4">${condo.address || 'N/A'}</td><td class="p-4">${ownerName}</td><td class="p-4">${managerName}</td><td class="p-4"><div class="flex space-x-4"><button title="Assign Manager" class="assign-manager-btn text-blue-400 hover:text-blue-300" data-condo-id="${condoDoc.id}" data-condo-name="${condo.condominiumName}"><i class="fas fa-user-cog fa-lg"></i></button><button title="Assign Staff" class="assign-staff-btn text-yellow-400 hover:text-yellow-300" data-condo-id="${condoDoc.id}" data-condo-name="${condo.condominiumName}"><i class="fas fa-users fa-lg"></i></button></div></td></tr>`;
        });
        tableBody.innerHTML = rowsHtml;
    } catch (error) {
        console.error("Error loading condos:", error);
        tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Error loading data.</td></tr>`;
    } finally {
        hideLoading();
    }
}

// --- MODAL DISPLAY FUNCTIONS ---
async function showOwnerFlats(ownerId, ownerName) {
    const modal = document.getElementById('flats-modal');
    const modalTitle = document.getElementById('flats-modal-title');
    const tableBody = document.getElementById('flats-table-body');
    document.getElementById('flats-search').value = '';
    modalTitle.textContent = `Flats of ${ownerName}`;
    tableBody.innerHTML = `<tr><td colspan="2" class="p-4 text-center">Loading...</td></tr>`;
    modal.classList.remove('hidden');
    try {
        const flatsQuery = query(collection(db, "condominiums"), where("ownerId", "==", ownerId));
        const querySnapshot = await getDocs(flatsQuery);
        if (querySnapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="2" class="p-4 text-center text-gray-400">This owner has no flats assigned.</td></tr>`;
        } else {
            tableBody.innerHTML = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return `<tr class="border-b border-gray-700"><td class="p-4">${data.condominiumName || 'N/A'}</td><td class="p-4">${data.address || 'N/A'}</td></tr>`;
            }).join('');
        }
    } catch (error) {
        handleFirestoreError(error, "loading owner's flats");
    }
}

async function showStaffFlats(staffId, staffName) {
    const modal = document.getElementById('flats-modal');
    const modalTitle = document.getElementById('flats-modal-title');
    const tableBody = document.getElementById('flats-table-body');
    document.getElementById('flats-search').value = '';
    modalTitle.textContent = `Flats Assigned to ${staffName}`;
    tableBody.innerHTML = `<tr><td colspan="2" class="p-4 text-center">Loading...</td></tr>`;
    modal.classList.remove('hidden');
    try {
        const flatsQuery = query(collection(db, "condominiums"), where("assignedStaffUids", "array-contains", staffId));
        const querySnapshot = await getDocs(flatsQuery);
        if (querySnapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="2" class="p-4 text-center text-gray-400">No flats are assigned to this staff member.</td></tr>`;
        } else {
            tableBody.innerHTML = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return `<tr class="border-b border-gray-700"><td class="p-4">${data.condominiumName || 'N/A'}</td><td class="p-4">${data.address || 'N/A'}</td></tr>`;
            }).join('');
        }
    } catch (error) {
        handleFirestoreError(error, "Staff's Assigned Flats");
    }
}

async function showStaffPoints(staffId, staffName) {
    const modal = document.getElementById('points-modal');
    const modalTitle = document.getElementById('points-modal-title');
    const tableBody = document.getElementById('points-table-body');
    modalTitle.textContent = `Points Breakdown for ${staffName}`;
    tableBody.innerHTML = `<tr><td colspan="2" class="p-4 text-center">Loading...</td></tr>`;
    modal.classList.remove('hidden');
    try {
        const condosSnapshot = await getDocs(collection(db, "condominiums"));
        const condoNames = {};
        condosSnapshot.forEach(doc => {
            condoNames[doc.id] = doc.data().condominiumName || 'Unknown Flat';
        });
        const reportsQuery = query(collectionGroup(db, 'cleaning_reports'), where("staffUid", "==", staffId));
        const reportsSnapshot = await getDocs(reportsQuery);
        const pointsByFlat = {};
        reportsSnapshot.forEach(reportDoc => {
            const reportData = reportDoc.data();
            if (reportData.managerRating && reportData.managerRating > 0) {
                const condoId = reportDoc.ref.parent.parent.id;
                pointsByFlat[condoId] = (pointsByFlat[condoId] || 0) + reportData.managerRating;
            }
        });
        if (Object.keys(pointsByFlat).length === 0) {
            tableBody.innerHTML = `<tr><td colspan="2" class="p-4 text-center text-gray-400">No points have been recorded.</td></tr>`;
        } else {
            let rowsHtml = Object.entries(pointsByFlat).map(([condoId, points]) => `<tr class="border-b border-gray-700"><td class="p-4">${condoNames[condoId] || 'Unknown Flat'}</td><td class="p-4">${points}</td></tr>`).join('');
            tableBody.innerHTML = rowsHtml;
        }
    } catch (error) {
        handleFirestoreError(error, "Staff's Points Breakdown");
    }
}

// --- ASSIGNMENT LOGIC ---
async function openAssignmentModal(type, condoId, condoName) {
    showLoading();
    saveAssignmentBtn.dataset.type = type;
    saveAssignmentBtn.dataset.condoId = condoId;
    const condoDoc = await getDoc(doc(db, "condominiums", condoId));
    const currentAssignments = condoDoc.data();
    if (type === 'manager') {
        assignModalTitle.textContent = `Assign Manager to ${condoName}`;
        const managersSnapshot = await getDocs(query(collection(db, "users"), where("role", "==", "CONDOMINIUM_MANAGER")));
        let optionsHtml = '<option value="">-- Unassign --</option>';
        managersSnapshot.forEach(managerDoc => {
            const selected = currentAssignments.managerUid === managerDoc.id ? 'selected' : '';
            optionsHtml += `<option value="${managerDoc.id}" ${selected}>${managerDoc.data().managerName}</option>`;
        });
        assignModalContent.innerHTML = `<label class="block mb-2">Select a Manager:</label><select id="assignment-select" class="w-full bg-gray-700 p-2 rounded">${optionsHtml}</select>`;
    } else if (type === 'staff') {
        assignModalTitle.textContent = `Assign Staff to ${condoName}`;
        const staffSnapshot = await getDocs(query(collection(db, "users"), where("role", "==", "STAFF")));
        let checkboxesHtml = '<div class="space-y-2 max-h-64 overflow-y-auto">';
        const assignedStaff = currentAssignments.assignedStaffUids || [];
        staffSnapshot.forEach(staffDoc => {
            const checked = assignedStaff.includes(staffDoc.id) ? 'checked' : '';
            checkboxesHtml += `<div class="p-2 bg-gray-700/50 rounded"><input type="checkbox" id="${staffDoc.id}" value="${staffDoc.id}" class="accent-blue-500" ${checked}><label for="${staffDoc.id}" class="ml-2">${staffDoc.data().staffName}</label></div>`;
        });
        assignModalContent.innerHTML = checkboxesHtml + '</div>';
    }
    hideLoading();
    openModal(assignModal);
}

saveAssignmentBtn.addEventListener('click', async () => {
    showLoading();
    const { type, condoId } = saveAssignmentBtn.dataset;
    const condoRef = doc(db, "condominiums", condoId);
    try {
        if (type === 'manager') {
            const selectedManagerId = document.getElementById('assignment-select').value;
            await updateDoc(condoRef, { managerUid: selectedManagerId || null });
        } else if (type === 'staff') {
            const checkboxes = assignModalContent.querySelectorAll('input[type="checkbox"]');
            const newAssignments = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
            await updateDoc(condoRef, { assignedStaffUids: newAssignments });
        }
        alert('Assignments updated successfully!');
        closeModal(assignModal);
        loadCondos();
    } catch (error) {
        alert(`Error updating assignment: ${error.message}`);
    } finally {
        hideLoading();
    }
});

// --- EVENT LISTENERS ---
document.getElementById('flats-modal-close-button').addEventListener('click', () => closeModal(document.getElementById('flats-modal')));
document.getElementById('points-modal-close-button').addEventListener('click', () => closeModal(document.getElementById('points-modal')));

document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const modal = e.target.closest('#assign-modal, #flats-modal, #points-modal');
        if (modal) closeModal(modal);
    });
});

contentPages.users.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    const { userId, userName } = button.dataset;
    if (button.classList.contains('view-owner-flats-btn')) showOwnerFlats(userId, userName);
    if (button.classList.contains('view-staff-flats-btn')) showStaffFlats(userId, userName);
    if (button.classList.contains('view-points-btn')) showStaffPoints(userId, userName);
});

contentPages.condos.addEventListener('click', async (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    const { condoId, condoName } = button.dataset;
    if (button.classList.contains('assign-manager-btn')) openAssignmentModal('manager', condoId, condoName);
    if (button.classList.contains('assign-staff-btn')) openAssignmentModal('staff', condoId, condoName);
});

// --- SEARCH FUNCTIONALITY ---
document.getElementById('user-search').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    document.querySelectorAll('#users-table-body tr').forEach(row => {
        const name = row.cells[0]?.textContent.toLowerCase() || '';
        const email = row.cells[1]?.textContent.toLowerCase() || '';
        row.style.display = (name.includes(searchTerm) || email.includes(searchTerm)) ? '' : 'none';
    });
});

document.getElementById('flats-search').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    document.querySelectorAll('#flats-table-body tr').forEach(row => {
        const name = row.cells[0]?.textContent.toLowerCase() || '';
        const address = row.cells[1]?.textContent.toLowerCase() || '';
        row.style.display = (name.includes(searchTerm) || address.includes(searchTerm)) ? '' : 'none';
    });
});

document.getElementById('condos-search').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    document.querySelectorAll('#condos-table-body tr').forEach(row => {
        let textContent = Array.from(row.cells).map(cell => cell.textContent.toLowerCase()).join(' ');
        row.style.display = textContent.includes(searchTerm) ? '' : 'none';
    });
});

// --- GENERIC EXPORT FUNCTION ---
function exportTableToCSV(filename, tableBodyId, tableHeaderId) {
    const table = document.getElementById(tableBodyId);
    const headerRow = document.getElementById(tableHeaderId);
    if (!table || !headerRow) {
        console.error("Table or Header element not found for exporting.");
        return;
    }
    let csv = [];
    const headers = [];
    headerRow.querySelectorAll('th').forEach(th => {
        const headerText = th.textContent.trim();
        if (headerText.toLowerCase() !== 'actions') {
            headers.push(`"${headerText.replace(/"/g, '""')}"`);
        }
    });
    csv.push(headers.join(','));
    table.querySelectorAll('tr').forEach(row => {
        if (row.style.display === 'none') return;
        const rowData = [];
        row.querySelectorAll('td').forEach((td, index) => {
            if (index < headers.length) {
                let cellData = (td.dataset.exportValue || td.textContent).trim().replace(/"/g, '""');
                rowData.push(`"${cellData}"`);
            }
        });
        csv.push(rowData.join(','));
    });
    const csvContent = csv.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}