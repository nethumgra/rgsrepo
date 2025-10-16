// ==========================================================
//           FIXED CHANGE_ASSIGNMENT.JS FILE EKA
//       (collection() bawitha karala hadapu eka)
// ==========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, query, where, writeBatch, limit } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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

const managerNameEl = document.getElementById('manager-name');
const currentAssignmentEl = document.getElementById('current-assignment');
const flatsDropdown = document.getElementById('flats-dropdown');
const assignmentForm = document.getElementById('assignment-form');
const statusMessageEl = document.getElementById('status-message');
const loadingSpinner = document.getElementById('loading-spinner');

let managerId = null;
let currentCondoRef = null; // Denata assign karapu flat eke sampurna reference eka

const showLoading = () => loadingSpinner.classList.remove('hidden');
const hideLoading = () => loadingSpinner.classList.add('hidden');

document.addEventListener('DOMContentLoaded', async () => {
    showLoading();
    
    const params = new URLSearchParams(window.location.search);
    managerId = params.get('managerId');
    const managerName = decodeURIComponent(params.get('managerName'));

    if (!managerId || !managerName) {
        managerNameEl.textContent = 'Error!';
        currentAssignmentEl.textContent = 'Manager details not found in URL.';
        hideLoading();
        return;
    }

    managerNameEl.textContent = managerName;

    try {
        // ### FIX IS HERE ###
        // Use collection() because 'condominiums' is a top-level collection, not a collection group.
        const condosRef = collection(db, 'condominiums'); 
        
        // Query to find the specific condo assigned to this manager
        const managerCondoQuery = query(condosRef, where("managerUid", "==", managerId), limit(1));
        
        // Run both queries at the same time: one to get ALL condos, one to get the MANAGER's condo.
        const [allCondosSnapshot, managerCondoSnapshot] = await Promise.all([
            getDocs(condosRef),
            getDocs(managerCondoQuery)
        ]);

        if (!managerCondoSnapshot.empty) {
            const currentCondoDoc = managerCondoSnapshot.docs[0];
            currentCondoRef = currentCondoDoc.ref; // Reference eka save karagannawa
            currentAssignmentEl.textContent = currentCondoDoc.data().condominiumName || 'Unnamed Flat';
        } else {
            currentAssignmentEl.textContent = 'Not Assigned';
        }

        flatsDropdown.innerHTML = ''; 
        const unassignOption = document.createElement('option');
        unassignOption.value = "UNASSIGN";
        unassignOption.textContent = "--- Unassign Manager ---";
        flatsDropdown.appendChild(unassignOption);

        allCondosSnapshot.forEach(doc => {
            const flat = doc.data();
            // Only show unassigned flats OR the flat currently assigned to this manager
            if (!flat.managerUid || flat.managerUid === managerId) {
                const option = document.createElement('option');
                // Value eka widiyata document eke sampurna path eka denawa
                option.value = doc.ref.path; 
                option.textContent = flat.condominiumName || 'Unnamed Flat';
                flatsDropdown.appendChild(option);
            }
        });

        // Set the dropdown to the currently assigned flat, if one exists
        flatsDropdown.value = currentCondoRef ? currentCondoRef.path : "UNASSIGN";

    } catch (error) {
        console.error("Error loading data: ", error);
        statusMessageEl.textContent = "Error loading data. Check console.";
        statusMessageEl.className = 'text-red-500 text-center mt-4 font-semibold';
    } finally {
        hideLoading();
    }
});

assignmentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();

    const selectedCondoPath = flatsDropdown.value;

    if (selectedCondoPath === (currentCondoRef ? currentCondoRef.path : "UNASSIGN")) {
        statusMessageEl.textContent = "No changes were made.";
        statusMessageEl.className = 'text-yellow-400 text-center mt-4 font-semibold';
        hideLoading();
        return;
    }
    
    try {
        const batch = writeBatch(db);

        // Paranata assign karapu flat ekak thibbanam eka update karanawa (managerUid eka null karanawa)
        if (currentCondoRef) {
            batch.update(currentCondoRef, { managerUid: null });
        }

        // Aluth flat ekak select karala thibbanam eka update karanawa (aluth managerId eka assign karanawa)
        if (selectedCondoPath && selectedCondoPath !== "UNASSIGN") {
            const newCondoRef = doc(db, selectedCondoPath); // Path eken document reference eka gannawa
            batch.update(newCondoRef, { managerUid: managerId });
        }

        await batch.commit();

        statusMessageEl.textContent = "Assignment updated successfully! You can close this tab.";
        statusMessageEl.className = 'text-green-400 text-center mt-4 font-semibold';
        
        // Page eka auto refresh karala, aluth data pennanawa
        setTimeout(() => { window.location.reload(); }, 2000);

    } catch (error) {
        console.error("Error updating assignment: ", error);
        statusMessageEl.textContent = "Error updating assignment. Check console.";
        statusMessageEl.className = 'text-red-500 text-center mt-4 font-semibold';
    } finally {
        hideLoading();
    }
});