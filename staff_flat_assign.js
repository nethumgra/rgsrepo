import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, query, where, writeBatch, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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
const db = getFirestore(app);

// DOM Elements
const staffNameEl = document.getElementById('staff-name');
const ownerSelector = document.getElementById('owner-selector');
const flatsContainer = document.getElementById('flats-checkbox-container');
const assignmentForm = document.getElementById('assignment-form');
const statusMessageEl = document.getElementById('status-message');
const loadingSpinner = document.getElementById('loading-spinner');

// Global variables
let staffId = null;
let initialAssignedFlatsForOwner = new Set(); // Stores initial state for the CURRENTLY VIEWED owner

const showLoading = () => loadingSpinner.classList.remove('hidden');
const hideLoading = () => loadingSpinner.classList.add('hidden');

// ---- PAGE LOAD LOGIC ----
// 1. Mulin owners-la witharak load karanawa (Mobile App eke wage)
document.addEventListener('DOMContentLoaded', async () => {
    showLoading();
    
    const params = new URLSearchParams(window.location.search);
    staffId = params.get('staffId');
    const staffName = decodeURIComponent(params.get('staffName'));

    if (!staffId || !staffName) {
        staffNameEl.textContent = 'Error!';
        hideLoading();
        return;
    }
    staffNameEl.textContent = staffName;

    try {
        // Flats okkoma ganna nathuwa, owners-la witharak gannawa
        const ownersQuery = query(collection(db, 'users'), where("role", "==", "OWNER"));
        const ownersSnapshot = await getDocs(ownersQuery);

        // Owner dropdown eka purawanawa
        ownerSelector.innerHTML = '<option value="">-- Select an Owner --</option>';
        ownersSnapshot.forEach(doc => {
            const owner = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = owner.ownerName || 'Unnamed Owner';
            ownerSelector.appendChild(option);
        });

    } catch (error) {
        console.error("Error loading owners: ", error);
        statusMessageEl.textContent = "Error loading owners. Check console.";
        statusMessageEl.className = 'text-red-500 text-center mt-4 font-semibold';
    } finally {
        hideLoading();
    }
});

// ---- OWNER SELECTION LOGIC ----
// 2. Owner-wa select karapu gaman, eyaage flats tika witharak database eken gannawa
ownerSelector.addEventListener('change', async (event) => {
    const selectedOwnerId = event.target.value;
    flatsContainer.innerHTML = ''; 
    initialAssignedFlatsForOwner.clear(); // Clear previous owner's data

    if (!selectedOwnerId) {
        flatsContainer.innerHTML = '<p class="text-gray-500 italic text-center pt-8">Please select an owner first.</p>';
        return;
    }

    flatsContainer.innerHTML = '<p class="text-gray-400 text-center pt-8">Fetching flats...</p>';

    try {
        // Me query eka target karapu nisa, `list` permission oona na, `read` athi.
        const flatsQuery = query(collection(db, "condominiums"), where("ownerId", "==", selectedOwnerId));
        const flatsSnapshot = await getDocs(flatsQuery);

        flatsContainer.innerHTML = ''; // Clear "Fetching..." message

        if (flatsSnapshot.empty) {
            flatsContainer.innerHTML = '<p class="text-gray-400 text-center pt-8">This owner has no flats.</p>';
            return;
        }

        // Checkbox tika hadanawa
        flatsSnapshot.forEach(doc => {
            const flat = doc.data();
            const flatId = doc.id;
            const assignedStaff = flat.assignedStaffUids || [];
            const isAssigned = assignedStaff.includes(staffId);

            if (isAssigned) {
                initialAssignedFlatsForOwner.add(flatId);
            }

            const checkboxDiv = document.createElement('div');
            checkboxDiv.className = 'flex items-center bg-gray-700 p-2 rounded-md';
            checkboxDiv.innerHTML = `
                <input id="${flatId}" type="checkbox" value="${flatId}" class="w-5 h-5 accent-blue-500 bg-gray-900 border-gray-600 rounded" ${isAssigned ? 'checked' : ''}>
                <label for="${flatId}" class="ml-3 text-sm font-medium text-gray-300">${flat.condominiumName || 'Unnamed Flat'}</label>
            `;
            flatsContainer.appendChild(checkboxDiv);
        });

    } catch (error) {
        console.error("Error fetching flats for owner: ", error);
        flatsContainer.innerHTML = `<p class="text-red-500 text-center pt-8">Could not load flats. Error: ${error.message}</p>`;
    }
});

// ---- FORM SUBMIT LOGIC ----
assignmentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const selectedOwnerId = ownerSelector.value;

    if (!selectedOwnerId) {
        statusMessageEl.textContent = "Please select an owner before saving.";
        statusMessageEl.className = 'text-yellow-400 text-center mt-4 font-semibold';
        return;
    }
    
    showLoading();

    const currentlyCheckedFlatsInView = new Set(
        Array.from(flatsContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value)
    );

    try {
        const batch = writeBatch(db);

        // Process changes only for the visible flats
        flatsContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            const flatId = checkbox.value;
            const condoRef = doc(db, "condominiums", flatId);
            
            const wasInitiallyAssigned = initialAssignedFlatsForOwner.has(flatId);
            const isCurrentlyAssigned = currentlyCheckedFlatsInView.has(flatId);

            if (!wasInitiallyAssigned && isCurrentlyAssigned) {
                batch.update(condoRef, { assignedStaffUids: arrayUnion(staffId) });
            }
            else if (wasInitiallyAssigned && !isCurrentlyAssigned) {
                batch.update(condoRef, { assignedStaffUids: arrayRemove(staffId) });
            }
        });

        await batch.commit();

        statusMessageEl.textContent = "Assignments updated successfully! This tab will close shortly.";
        statusMessageEl.className = 'text-green-400 text-center mt-4 font-semibold';
        
        setTimeout(() => { 
            window.opener.location.reload(); 
            window.close(); 
        }, 2000);

    } catch (error) {
        console.error("Error updating assignments: ", error);
        statusMessageEl.textContent = "Error updating assignments. Check console.";
        statusMessageEl.className = 'text-red-500 text-center mt-4 font-semibold';
    } finally {
        hideLoading();
    }
});