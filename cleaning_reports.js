import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js"; 
import { getFirestore, collection, getDocs, doc, getDoc, query, where, orderBy, limit, collectionGroup } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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
const auth = getAuth(app);

// ===> LETTERHEAD IMAGE EKE NAMA ME THENATA HARIYATAMA DAANNA <===
const letterheadImageUrl = 'letterhead.png'; 

// DOM Elements
const tableBody = document.getElementById('reports-table-body');
const loadingSpinner = document.getElementById('loading-spinner');
const searchInput = document.getElementById('report-search');
const tasksModal = document.getElementById('tasks-modal');
const tasksList = document.getElementById('tasks-list');
const tasksModalCloseButton = document.getElementById('tasks-modal-close-button');
const ownerFilter = document.getElementById('owner-filter');
const flatFilter = document.getElementById('flat-filter');
const yearFilter = document.getElementById('year-filter');
const monthFilter = document.getElementById('month-filter');
const datePicker = document.getElementById('date-picker');
const clearFiltersBtn = document.getElementById('clear-filters-btn');
const exportBtn = document.getElementById('export-reports-btn');

// Global data stores
let reportsDataStore = {};
let allFlats = [];
let staffMap = {};

const showLoading = () => loadingSpinner.classList.remove('hidden');
const hideLoading = () => loadingSpinner.classList.add('hidden');

// This function converts an image file to a format jsPDF can use
async function loadImageAsBase64(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Image not found: ${response.statusText}`);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Error loading letterhead image:", error);
        return null;
    }
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === 'ADMIN') {
            await loadInitialData();
        } else {
            hideLoading();
            document.body.innerHTML = `<div class="text-center p-8 text-red-500">Access Denied. You must be an Admin. <a href="index.html" class="text-blue-400">Go back</a></div>`;
        }
    } else {
        window.location.href = 'index.html';
    }
});

async function loadInitialData() {
    showLoading();
    // Clear all previous data and state
    tableBody.innerHTML = '';
    reportsDataStore = {};
    allFlats = [];
    staffMap = {};
    ownerFilter.innerHTML = '<option value="">All Owners</option>';
    yearFilter.innerHTML = '<option value="">All Years</option>';
    
    try {
        const [flatsSnapshot, staffSnapshot, reportsSnapshot, ownersSnapshot] = await Promise.all([
            getDocs(collection(db, "condominiums")),
            getDocs(query(collection(db, "users"), where("role", "==", "STAFF"))),
            getDocs(query(collectionGroup(db, 'cleaning_reports'), orderBy("cleaningDate", "desc"))),
            getDocs(query(collection(db, "users"), where("role", "==", "OWNER")))
        ]);

        const flatsMap = {};
        flatsSnapshot.forEach(doc => {
            const flatData = { id: doc.id, ...doc.data() };
            flatsMap[doc.id] = flatData;
            allFlats.push(flatData);
        });

        staffSnapshot.forEach(doc => {
            staffMap[doc.id] = doc.data().staffName || 'Unknown Staff';
        });
        
        ownersSnapshot.forEach(doc => {
            const owner = doc.data();
            ownerFilter.innerHTML += `<option value="${doc.id}">${owner.ownerName || 'Unnamed Owner'}</option>`;
        });
        
        const uniqueYears = new Set();
        reportsSnapshot.docs.forEach(doc => {
            const date = doc.data().cleaningDate?.toDate();
            if (date) uniqueYears.add(date.getFullYear());
        });
        
        Array.from(uniqueYears).sort((a,b) => b-a).forEach(year => {
            yearFilter.innerHTML += `<option value="${year}">${year}</option>`;
        });
        
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        monthNames.forEach((month, index) => {
             monthFilter.innerHTML += `<option value="${index}">${month}</option>`;
        });


        if (reportsSnapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-400">No reports found.</td></tr>`;
        } else {
            renderReports(reportsSnapshot.docs, flatsMap);
        }

    } catch (error) {
        console.error("Error loading initial data:", error);
        tableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Error loading data.</td></tr>`;
    } finally {
        hideLoading();
    }
}

function renderReports(reportDocs, flatsMap) {
    let rowsHtml = '';
    reportDocs.forEach(doc => {
        const reportId = doc.id;
        const data = doc.data();
        reportsDataStore[reportId] = data;
        
        const date = data.cleaningDate?.toDate();
        const dateString = date ? date.toLocaleString() : 'No Date';
        
        const condoId = doc.ref.parent.parent.id;
        const flat = flatsMap[condoId];
        const flatName = flat?.condominiumName || 'Unknown Flat';
        const ownerId = flat?.ownerId || '';
        const staffName = staffMap[data.staffUid] || 'Unknown Staff';
        
        let reviewExportValue = 'Pending';
        let reviewDisplayHtml = `<span class="px-2 py-1 text-xs font-semibold text-yellow-800 bg-yellow-200 rounded-full">Pending</span>`;
        if (data.reviewedByManager) {
            reviewExportValue = `${data.managerRating} Stars`;
            let stars = '';
            for (let i = 0; i < 5; i++) stars += `<i class="fas fa-star ${i < data.managerRating ? 'text-amber-400' : 'text-gray-500'}"></i>`;
            reviewDisplayHtml = `<div class="flex items-center">${stars}</div>`;
        }

        rowsHtml += `
            <tr class="hover:bg-gray-700 border-b border-gray-700 cursor-pointer" 
                data-report-id="${reportId}" 
                data-condo-id="${condoId}" 
                data-owner-id="${ownerId}"
                data-date-iso="${date ? date.toISOString().split('T')[0] : ''}"
                data-year="${date ? date.getFullYear() : ''}"
                data-month="${date ? date.getMonth() : ''}"
                data-export-review="${reviewExportValue}">
                <td class="p-4">${dateString}</td>
                <td class="p-4">${flatName}</td>
                <td class="p-4">${staffName}</td>
                <td class="p-4">${reviewDisplayHtml}</td>
            </tr>`;
    });
    tableBody.innerHTML = rowsHtml;
}

function applyFilters() {
    const selectedOwnerId = ownerFilter.value;
    const selectedFlatId = flatFilter.value;
    const selectedYear = yearFilter.value;
    const selectedMonth = monthFilter.value;
    const selectedDate = datePicker.value;
    const searchTerm = searchInput.value.toLowerCase();

    document.querySelectorAll('#reports-table-body tr').forEach(row => {
        const ownerMatch = !selectedOwnerId || (row.dataset.ownerId === selectedOwnerId);
        const flatMatch = !selectedFlatId || (row.dataset.condoId === selectedFlatId);
        const yearMatch = !selectedYear || (row.dataset.year === selectedYear);
        const monthMatch = !selectedMonth || (row.dataset.month === selectedMonth);
        const dateMatch = !selectedDate || (row.dataset.dateIso === selectedDate);
        const searchMatch = !searchTerm || row.textContent.toLowerCase().includes(searchTerm);

        row.style.display = (ownerMatch && flatMatch && yearMatch && monthMatch && dateMatch && searchMatch) ? '' : 'none';
    });
}

// ===> ALUTHEN HADAPU PDF EXPORT FUNCTION EKA <===
async function exportReportsToPDF() {
    showLoading();
    
    // 1. Export karana welawedi witharak image eka load karanawa
    const letterheadBase64 = await loadImageAsBase64(letterheadImageUrl);

    if (!letterheadBase64) {
        alert("CRITICAL ERROR: Letterhead image could not be loaded. Please check the file name and location.");
        hideLoading();
        return; // Stop if image fails to load
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.addImage(letterheadBase64, 'PNG', 0, 0, pageWidth, pageHeight);

    let title = "Cleaning Reports";
    let subTitleParts = [];

    const ownerText = ownerFilter.value ? ownerFilter.options[ownerFilter.selectedIndex].text : '';
    const flatText = flatFilter.value ? flatFilter.options[flatFilter.selectedIndex].text : '';
    const yearText = yearFilter.value;
    const monthText = monthFilter.value ? monthFilter.options[monthFilter.selectedIndex].text : '';
    const dateText = datePicker.value;

    if (dateText) {
        subTitleParts.push(`for date: ${dateText}`);
    } else {
        if (ownerText && ownerText !== 'All Owners') subTitleParts.push(`Owner: ${ownerText}`);
        if (flatText && flatText !== 'All Flats' && flatText !== 'Select an Owner First') subTitleParts.push(`Flat: ${flatText}`);
        if (yearText && yearText !== 'All Years') subTitleParts.push(`Year: ${yearText}`);
        if (monthText && monthText !== 'All Months') subTitleParts.push(`Month: ${monthText}`);
    }
    
    const head = [['Date', 'Flat Name', 'Cleaned By', 'Review', 'Tasks Completed']];
    const body = [];
    const visibleRows = document.querySelectorAll('#reports-table-body tr:not([style*="display: none"])');

    visibleRows.forEach(row => {
        const reportId = row.dataset.reportId;
        const reportData = reportsDataStore[reportId];
        
        const date = row.cells[0].textContent;
        const flatName = row.cells[1].textContent;
        const staffName = row.cells[2].textContent;
        const review = row.dataset.exportReview;
        
        let tasksText = "No tasks recorded.";
        if (reportData && reportData.tasksCompleted && reportData.tasksCompleted.length > 0) {
            tasksText = reportData.tasksCompleted.map(task => `- ${task}`).join('\n');
        }
        body.push([date, flatName, staffName, review, tasksText]);
    });
    
    const contentStartY = 65; 
    
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text(title, 14, contentStartY);
    
    if(subTitleParts.length > 0) {
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Filters: ${subTitleParts.join(' | ')}`, 14, contentStartY + 7);
    }

    doc.autoTable({
        head: head,
        body: body,
        startY: contentStartY + 10,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, textColor: [40, 40, 40] },
        headStyles: { fillColor: [22, 160, 133], textColor: [255, 255, 255] },
    });

    doc.save('cleaning_reports_with_letterhead.pdf');
    hideLoading();
}


// Event Listeners
ownerFilter.addEventListener('change', () => {
    const selectedOwnerId = ownerFilter.value;
    flatFilter.innerHTML = '<option value="">All Flats</option>';
    
    if (selectedOwnerId) {
        const ownerFlats = allFlats.filter(flat => flat.ownerId === selectedOwnerId);
        ownerFlats.forEach(flat => {
            flatFilter.innerHTML += `<option value="${flat.id}">${flat.condominiumName || 'Unnamed Flat'}</option>`;
        });
        flatFilter.disabled = false;
    } else {
        flatFilter.disabled = true;
        flatFilter.innerHTML = '<option value="">Select an Owner First</option>';
    }
    applyFilters();
});

[flatFilter, yearFilter, monthFilter, datePicker, searchInput].forEach(el => {
    el.addEventListener('input', applyFilters);
});

clearFiltersBtn.addEventListener('click', () => {
    ownerFilter.value = '';
    flatFilter.value = '';
    yearFilter.value = '';
    monthFilter.value = '';
    datePicker.value = '';
    searchInput.value = '';
    flatFilter.disabled = true;
    flatFilter.innerHTML = '<option value="">Select an Owner First</option>';
    applyFilters();
});

exportBtn.addEventListener('click', exportReportsToPDF);

tableBody.addEventListener('click', (e) => {
    const row = e.target.closest('tr');
    if (!row || !row.dataset.reportId) return;
    
    const reportData = reportsDataStore[row.dataset.reportId];
    tasksList.innerHTML = '';
    if (reportData && reportData.tasksCompleted && reportData.tasksCompleted.length > 0) {
        reportData.tasksCompleted.forEach(task => {
            tasksList.innerHTML += `<li class="flex items-center bg-gray-700 p-2 rounded-md"><i class="fas fa-check-circle text-green-400 mr-3"></i> ${task}</li>`;
        });
    } else {
        tasksList.innerHTML = '<li class="text-gray-400 italic">No tasks were recorded.</li>';
    }
    tasksModal.classList.remove('hidden');
});

tasksModalCloseButton.addEventListener('click', () => {
    tasksModal.classList.add('hidden');
});