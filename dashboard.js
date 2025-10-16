import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js"; 
import { getFirestore, collection, getDocs, doc, getDoc, query, where, collectionGroup } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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

const loadingSpinner = document.getElementById('loading-spinner');
const logoutButton = document.getElementById('logout-button');

const showLoading = () => loadingSpinner.classList.remove('hidden');
const hideLoading = () => loadingSpinner.classList.add('hidden');

// Auth check for this page
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === 'ADMIN') {
            await initializeProfessionalDashboard();
        } else {
            hideLoading();
            document.body.innerHTML = `<div class="text-center p-8 text-red-500">Access Denied. You must be an Admin. <a href="index.html" class="text-blue-400">Go back</a></div>`;
        }
    } else {
        window.location.href = 'index.html';
    }
});

async function initializeProfessionalDashboard() {
    showLoading();
    try {
        const [usersSnapshot, reportsSnapshot] = await Promise.all([
            getDocs(collection(db, "users")),
            getDocs(collectionGroup(db, "cleaning_reports"))
        ]);

        // --- 1. Process Data for Charts and Lists ---
        let ownerCount = 0, managerCount = 0, staffCount = 0;
        const staffList = [];
        
        usersSnapshot.forEach(userDoc => {
            const user = userDoc.data();
            switch(user.role) {
                case 'OWNER': ownerCount++; break;
                case 'CONDOMINIUM_MANAGER': managerCount++; break;
                case 'STAFF': 
                    staffCount++;
                    staffList.push({ name: user.staffName || 'Unnamed Staff', points: user.totalPoints || 0 });
                    break;
            }
        });

        const monthlyReportCounts = Array(12).fill(0);
        const currentYear = new Date().getFullYear();
        reportsSnapshot.forEach(reportDoc => {
            const reportDate = reportDoc.data().cleaningDate?.toDate();
            if (reportDate && reportDate.getFullYear() === currentYear) {
                const month = reportDate.getMonth();
                monthlyReportCounts[month]++;
            }
        });
        
        // --- 2. Render UI Components ---
        renderMonthlyReportsChart(monthlyReportCounts);
        renderUsersBreakdownChart(ownerCount, managerCount, staffCount);
        
        const top5Staff = staffList.sort((a, b) => b.points - a.points).slice(0, 5);
        renderTopStaffList(top5Staff);

    } catch (error) {
        console.error("Error loading dashboard data:", error);
        alert("Could not load dashboard data. Check the console.");
    } finally {
        hideLoading();
    }
}

function renderMonthlyReportsChart(data) {
    const ctx = document.getElementById('monthlyReportsChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [{
                label: 'Reports this Year',
                data: data,
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
            }]
        },
        options: {
            scales: {
                y: { beginAtZero: true, ticks: { color: '#9ca3af' }, grid: { color: '#374151' } },
                x: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } }
            },
            plugins: { legend: { labels: { color: '#d1d5db' } } }
        }
    });
}

function renderUsersBreakdownChart(ownerCount, managerCount, staffCount) {
    const ctx = document.getElementById('usersBreakdownChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Owners', 'Managers', 'Staff'],
            datasets: [{
                data: [ownerCount, managerCount, staffCount],
                backgroundColor: ['#3b82f6', '#f59e0b', '#10b981'],
                hoverOffset: 4,
                borderColor: '#1f2937'
            }]
        },
        options: {
             plugins: {
                legend: { position: 'bottom', labels: { color: '#d1d5db' } }
            }
        }
    });
}

function renderTopStaffList(topStaff) {
    const listContainer = document.getElementById('top-staff-list');
    listContainer.innerHTML = ''; // Clear previous list

    if (topStaff.length === 0) {
        listContainer.innerHTML = '<p class="text-gray-500">No staff found.</p>';
        return;
    }

    topStaff.forEach((staff, index) => {
        const medalColor = index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-amber-600' : 'text-gray-600';
        
        const staffElement = document.createElement('div');
        staffElement.className = 'flex items-center justify-between bg-gray-700/50 p-3 rounded-lg';
        staffElement.innerHTML = `
            <div class="flex items-center">
                <span class="w-8 text-center"><i class="fas fa-medal ${medalColor}"></i></span>
                <span class="font-semibold text-gray-300">${staff.name}</span>
            </div>
            <span class="font-bold text-blue-400">${staff.points} pts</span>
        `;
        listContainer.appendChild(staffElement);
    });
}

logoutButton.addEventListener('click', () => signOut(auth));