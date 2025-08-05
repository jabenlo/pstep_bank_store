// Global state
let currentUser = null;
let currentStudent = null;
let cart = {};

// API Base URL
const API_BASE = '/api';

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
});

// Authentication functions
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}/auth/check-auth`);
        const data = await response.json();
        
        if (data.authenticated) {
            if (data.user_type === 'teacher') {
                currentUser = data.user;
                showTeacherDashboard();
            } else if (data.user_type === 'student') {
                currentStudent = data.student;
                showStudentDashboard();
            }
        } else {
            showLoginScreen();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        showLoginScreen();
    }
}

async function teacherLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('teacherUsername').value;
    const password = document.getElementById('teacherPassword').value;
    
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            showToast('Login successful!', 'success');
            showTeacherDashboard();
        } else {
            showToast(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

async function studentLogin(event) {
    event.preventDefault();
    
    const student_id = document.getElementById('studentId').value;
    
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ student_id })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentStudent = data.student;
            showToast('Login successful!', 'success');
            showStudentDashboard();
        } else {
            showToast(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

async function teacherRegister(event) {
    event.preventDefault();
    
    const username = document.getElementById('regUsername').value;
    const password = document.getElementById('regPassword').value;
    
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            showToast('Account created successfully!', 'success');
            showTeacherDashboard();
        } else {
            showToast(data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

async function logout() {
    try {
        await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
        currentUser = null;
        currentStudent = null;
        cart = {};
        showLoginScreen();
        showToast('Logged out successfully', 'success');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Screen management
function showLoginScreen() {
    hideAllScreens();
    document.getElementById('loginScreen').classList.add('active');
    document.getElementById('userInfo').style.display = 'none';
}

function showTeacherDashboard() {
    hideAllScreens();
    document.getElementById('teacherDashboard').classList.add('active');
    document.getElementById('userInfo').style.display = 'flex';
    document.getElementById('userName').textContent = currentUser.username;
    loadTeacherDashboard();
}

function showStudentDashboard() {
    hideAllScreens();
    document.getElementById('studentDashboard').classList.add('active');
    document.getElementById('userInfo').style.display = 'flex';
    document.getElementById('userName').textContent = currentStudent.name;
    loadStudentDashboard();
}

function hideAllScreens() {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
}

// Tab management
function switchTab(tab) {
    document.querySelectorAll('.login-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.login-form').forEach(form => {
        form.classList.remove('active');
    });
    
    event.target.classList.add('active');
    
    if (tab === 'teacher') {
        document.getElementById('teacherLogin').classList.add('active');
    } else {
        document.getElementById('studentLogin').classList.add('active');
    }
}

function switchDashboardTab(tab) {
    document.querySelectorAll('.dashboard-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    event.target.classList.add('active');
    document.getElementById(tab + 'Tab').classList.add('active');
    
    if (tab === 'students') {
        loadStudents();
    } else if (tab === 'store') {
        loadItems();
    } else if (tab === 'profile') {
        loadProfile();
    }
}

function switchStudentTab(tab) {
    document.querySelectorAll('.dashboard-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    event.target.classList.add('active');
    
    if (tab === 'account') {
        document.getElementById('accountTab').classList.add('active');
        loadStudentAccount();
    } else if (tab === 'store') {
        document.getElementById('studentStoreTab').classList.add('active');
        loadStore();
    } else if (tab === 'cart') {
        document.getElementById('cartTab').classList.add('active');
        loadCart();
    }
}

// Login form management
function showRegister() {
    document.querySelectorAll('.login-form').forEach(form => {
        form.classList.remove('active');
    });
    document.getElementById('teacherRegister').classList.add('active');
}

function showLogin() {
    document.querySelectorAll('.login-form').forEach(form => {
        form.classList.remove('active');
    });
    document.getElementById('teacherLogin').classList.add('active');
}

// Teacher dashboard functions
async function loadTeacherDashboard() {
    try {
        const response = await fetch(`${API_BASE}/teacher/dashboard`);
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('totalStudents').textContent = data.students.length;
            document.getElementById('totalItems').textContent = data.items.length;
            document.getElementById('totalRevenue').textContent = `${data.total_revenue.toFixed(2)}`;
            
            // Load students by default
            loadStudents();
        }
    } catch (error) {
        showToast('Failed to load dashboard', 'error');
    }
}

async function loadStudents() {
    try {
        const response = await fetch(`${API_BASE}/teacher/dashboard`);
        const data = await response.json();
        
        if (response.ok) {
            const studentsGrid = document.getElementById('studentsGrid');
            studentsGrid.innerHTML = '';
            
            data.students.forEach(student => {
                const studentCard = createStudentCard(student);
                studentsGrid.appendChild(studentCard);
            });
        }
    } catch (error) {
        showToast('Failed to load students', 'error');
    }
}

function createStudentCard(student) {
    const card = document.createElement('div');
    card.className = 'student-card';
    card.innerHTML = `
        <h3>${student.name}</h3>
        <p><strong>ID:</strong> ${student.student_id}</p>
        <p><strong>Balance:</strong> ${student.balance.toFixed(2)}</p>
        <div class="card-actions">
            <button class="btn btn-primary btn-small" onclick="showUpdateBalance(${student.id}, '${student.name}', ${student.balance})">
                <i class="fas fa-dollar-sign"></i> Update Balance
            </button>
            <button class="btn btn-outline btn-small" onclick="downloadStatement(${student.id})">
                <i class="fas fa-download"></i> Statement
            </button>
            <button class="btn btn-danger btn-small" onclick="deleteStudent(${student.id})">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    `;
    return card;
}

async function loadItems() {
    try {
        const response = await fetch(`${API_BASE}/teacher/dashboard`);
        const data = await response.json();
        
        if (response.ok) {
            const itemsGrid = document.getElementById('itemsGrid');
            itemsGrid.innerHTML = '';
            
            data.items.forEach(item => {
                const itemCard = createItemCard(item);
                itemsGrid.appendChild(itemCard);
            });
        }
    } catch (error) {
        showToast('Failed to load items', 'error');
    }
}

function createItemCard(item) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
        ${item.image_path ? `<img src="${item.image_path}" alt="${item.name}" class="item-image">` : ''}
        <h3>${item.name}</h3>
        <p>${item.description || 'No description'}</p>
        <p><strong>Price:</strong> ${item.price.toFixed(2)}</p>
        <div class="card-actions">
            <button class="btn btn-primary btn-small" onclick="showEditItem(${item.id})">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn btn-danger btn-small" onclick="deleteItem(${item.id})">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    `;
    return card;
}

function loadProfile() {
    document.getElementById('profileUsername').value = currentUser.username;
    document.getElementById('profilePassword').value = '';
}

// Student dashboard functions
async function loadStudentDashboard() {
    try {
        const response = await fetch(`${API_BASE}/student/dashboard`);
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('studentBalance').textContent = `${data.student.balance.toFixed(2)}`;
            loadStudentAccount();
        }
    } catch (error) {
        showToast('Failed to load dashboard', 'error');
    }
}

async function loadStudentAccount() {
    try {
        const response = await fetch(`${API_BASE}/student/transactions`);
        const data = await response.json();
        
        if (response.ok) {
            const transactionsList = document.getElementById('transactionsList');
            transactionsList.innerHTML = '';
            
            if (data.transactions.length === 0) {
                transactionsList.innerHTML = '<p class="text-center">No transactions yet.</p>';
                return;
            }
            
            data.transactions.forEach(transaction => {
                const transactionItem = createTransactionItem(transaction);
                transactionsList.appendChild(transactionItem);
            });
        }
    } catch (error) {
        showToast('Failed to load transactions', 'error');
    }
}

function createTransactionItem(transaction) {
    const item = document.createElement('div');
    item.className = `transaction-item transaction-${transaction.type}`;
    
    const date = new Date(transaction.created_at).toLocaleDateString();
    const amount = transaction.type === 'credit' ? `+${transaction.amount.toFixed(2)}` : `-${transaction.amount.toFixed(2)}`;
    const transactionType = transaction.type === 'credit' ? 'Deposit' : 'Withdraw';
    
    item.innerHTML = `
        <div class="transaction-info">
            <h4>${transaction.description}</h4>
            <p>${date} - ${transactionType}</p>
        </div>
        <div class="transaction-amount ${transaction.type}">${amount}</div>
    `;
    return item;
}

async function loadStore() {
    try {
        const response = await fetch(`${API_BASE}/student/store`);
        const data = await response.json();
        
        if (response.ok) {
            const storeGrid = document.getElementById('storeGrid');
            storeGrid.innerHTML = '';
            
            if (data.items.length === 0) {
                storeGrid.innerHTML = '<p class="text-center">No items available in the store.</p>';
                return;
            }
            
            data.items.forEach(item => {
                const storeItemCard = createStoreItemCard(item);
                storeGrid.appendChild(storeItemCard);
            });
        }
    } catch (error) {
        showToast('Failed to load store', 'error');
    }
}

function createStoreItemCard(item) {
    const card = document.createElement('div');
    card.className = 'store-item-card';
    card.innerHTML = `
        ${item.image_path ? `<img src="${item.image_path}" alt="${item.name}" class="item-image">` : ''}
        <h3>${item.name}</h3>
        <p>${item.description || 'No description'}</p>
        <div class="item-price">${item.price.toFixed(2)}</div>
        <button class="btn btn-primary" onclick="addToCart(${item.id})">
            <i class="fas fa-cart-plus"></i> Add to Cart
        </button>
    `;
    return card;
}

async function addToCart(itemId) {
    try {
        const response = await fetch(`${API_BASE}/student/cart`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ item_id: itemId, quantity: 1 })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Item added to cart!', 'success');
            updateCartCount();
        } else {
            showToast(data.error || 'Failed to add item to cart', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    }
}

async function loadCart() {
    try {
        const response = await fetch(`${API_BASE}/student/cart`);
        const data = await response.json();
        
        if (response.ok) {
            const cartItems = document.getElementById('cartItems');
            const cartTotal = document.getElementById('cartTotal');
            const checkoutBtn = document.getElementById('checkoutBtn');
            
            cartItems.innerHTML = '';
            
            if (data.cart_items.length === 0) {
                cartItems.innerHTML = '<p class="text-center">Your cart is empty.</p>';
                cartTotal.textContent = '0.00';
                checkoutBtn.disabled = true;
                return;
            }
            
            data.cart_items.forEach(cartItem => {
                const cartItemElement = createCartItem(cartItem);
                cartItems.appendChild(cartItemElement);
            });
            
            cartTotal.textContent = data.total.toFixed(2);
            checkoutBtn.disabled = false;
        }
    } catch (error) {
        showToast('Failed to load cart', 'error');
    }
}

function createCartItem(cartItem) {
    const item = document.createElement('div');
    item.className = 'cart-item';
    item.innerHTML = `
        ${cartItem.item.image_path ? `<img src="${cartItem.item.image_path}" alt="${cartItem.item.name}">` : '<div style="width: 60px; height: 60px; background: #f0f0f0; border-radius: 8px;"></div>'}
        <div class="cart-item-info">
            <h4>${cartItem.item.name}</h4>
            <p>${cartItem.item.price.toFixed(2)} each</p>
            <p><strong>Total: ${cartItem.item_total.toFixed(2)}</strong></p>
        </div>
        <div class="cart-item-controls">
            <button class="quantity-btn" onclick="updateCartQuantity(${cartItem.item.id}, ${cartItem.quantity - 1})">
                <i class="fas fa-minus"></i>
            </button>
            <span>${cartItem.quantity}</span>
            <button class="quantity-btn" onclick="updateCartQuantity(${cartItem.item.id}, ${cartItem.quantity + 1})">
                <i class="fas fa-plus"></i>
            </button>
            <button class="btn btn-danger btn-small" onclick="removeFromCart(${cartItem.item.id})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    return item;
}

async function updateCartQuantity(itemId, quantity) {
    try {
        if (quantity <= 0) {
            await removeFromCart(itemId);
            return;
        }
        
        const response = await fetch(`${API_BASE}/student/cart/${itemId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ quantity })
        });
        
        if (response.ok) {
            loadCart();
            updateCartCount();
        } else {
            const data = await response.json();
            showToast(data.error || 'Failed to update cart', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    }
}

async function removeFromCart(itemId) {
    try {
        const response = await fetch(`${API_BASE}/student/cart/${itemId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('Item removed from cart', 'success');
            loadCart();
            updateCartCount();
        } else {
            const data = await response.json();
            showToast(data.error || 'Failed to remove item', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    }
}

async function checkout() {
    if (!confirm('Are you sure you want to complete this purchase?')) {
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/student/purchase`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Purchase completed successfully!', 'success');
            document.getElementById('studentBalance').textContent = `${data.new_balance.toFixed(2)}`;
            loadCart();
            updateCartCount();
            loadStudentAccount();
        } else {
            showToast(data.error || 'Purchase failed', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

async function updateCartCount() {
    try {
        const response = await fetch(`${API_BASE}/student/cart`);
        const data = await response.json();
        
        if (response.ok) {
            const totalItems = data.cart_items.reduce((sum, item) => sum + item.quantity, 0);
            document.getElementById('cartCount').textContent = totalItems;
        }
    } catch (error) {
        console.error('Failed to update cart count:', error);
    }
}

// Modal functions
function showModal(title, content) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = content;
    document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

// Teacher modal functions
function showAddStudent() {
    const content = `
        <form onsubmit="addStudent(event)">
            <div class="form-group">
                <label for="studentName">Student Name</label>
                <input type="text" id="studentName" required>
            </div>
            <div class="form-group">
                <label for="newStudentId">Student ID</label>
                <input type="text" id="newStudentId" required>
            </div>
            <div class="form-group">
                <label for="initialBalance">Initial Balance</label>
                <input type="number" id="initialBalance" step="0.01" value="0.00">
            </div>
            <button type="submit" class="btn btn-primary">
                <i class="fas fa-plus"></i> Add Student
            </button>
        </form>
    `;
    showModal('Add New Student', content);
}

function showUpdateBalance(studentId, studentName, currentBalance) {
    const content = `
        <form onsubmit="updateStudent(event, ${studentId})">
            <div class="form-group">
                <label for="studentName">Student Name</label>
                <input type="text" id="studentName" value="${studentName}" required>
            </div>
            <div class="form-group">
                <label for="transactionType">Transaction Type</label>
                <select id="transactionType" required>
                    <option value="deposit">Deposit</option>
                    <option value="withdraw">Withdraw</option>
                </select>
            </div>
            <div class="form-group">
                <label for="amount">Amount</label>
                <input type="number" id="amount" step="0.01" min="0" required>
            </div>
            <div class="form-group">
                <label for="description">Description</label>
                <input type="text" id="description">
            </div>
            <p>Current Balance: ${currentBalance.toFixed(2)}</p>
            <button type="submit" class="btn btn-primary">
                <i class="fas fa-save"></i> Update Student
            </button>
        </form>
    `;
    showModal('Update Student', content);
}

function showAddItem() {
    const content = `
        <form onsubmit="addItem(event)" enctype="multipart/form-data">
            <div class="form-group">
                <label for="itemName">Item Name</label>
                <input type="text" id="itemName" required>
            </div>
            <div class="form-group">
                <label for="itemDescription">Description</label>
                <textarea id="itemDescription" rows="3"></textarea>
            </div>
            <div class="form-group">
                <label for="itemPrice">Price</label>
                <input type="number" id="itemPrice" step="0.01" min="0.01" required>
            </div>
            <div class="form-group">
                <label for="itemImage">Image (optional)</label>
                <input type="file" id="itemImage" accept="image/*">
            </div>
            <button type="submit" class="btn btn-primary">
                <i class="fas fa-plus"></i> Add Item
            </button>
        </form>
    `;
    showModal('Add New Item', content);
}

async function showEditItem(itemId) {
    try {
        const response = await fetch(`${API_BASE}/teacher/items/${itemId}`);
        const item = await response.json();
        
        if (response.ok) {
            const content = `
                <form onsubmit="updateItem(event, ${itemId})" enctype="multipart/form-data">
                    <div class="form-group">
                        <label for="itemName">Item Name</label>
                        <input type="text" id="itemName" value="${item.name}" required>
                    </div>
                    <div class="form-group">
                        <label for="itemDescription">Description</label>
                        <textarea id="itemDescription" rows="3">${item.description || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label for="itemPrice">Price</label>
                        <input type="number" id="itemPrice" step="0.01" min="0.01" value="${item.price}" required>
                    </div>
                    <div class="form-group">
                        <label for="itemImage">New Image (optional)</label>
                        <input type="file" id="itemImage" accept="image/*">
                    </div>
                    ${item.image_path ? `<p>Current image: ${item.image_path}</p>` : ''}
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-save"></i> Update Item
                    </button>
                </form>
            `;
            showModal('Edit Item', content);
        } else {
            showToast(item.error || 'Failed to load item details', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    }
}

// Teacher action functions
async function addStudent(event) {
    event.preventDefault();
    
    const name = document.getElementById('studentName').value;
    const student_id = document.getElementById('newStudentId').value;
    const balance = parseFloat(document.getElementById('initialBalance').value);
    
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/teacher/students`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, student_id, balance })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Student added successfully!', 'success');
            closeModal();
            loadStudents();
            loadTeacherDashboard();
        } else {
            showToast(data.error || 'Failed to add student', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

async function updateStudent(event, studentId) {
    event.preventDefault();
    
    const name = document.getElementById('studentName').value;
    const type = document.getElementById('transactionType').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const description = document.getElementById('description').value;
    
    const data = {
        name,
        type: type === 'deposit' ? 'credit' : 'debit',
        amount,
        description
    };
    
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/teacher/students/${studentId}/balance`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        const responseData = await response.json();
        
        if (response.ok) {
            showToast('Student balance updated successfully!', 'success');
            closeModal();
            loadStudents();
            loadTeacherDashboard();
        } else {
            showToast(responseData.error || 'Failed to update student balance', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
        console.error('Error updating student balance:', error);
    } finally {
        hideLoading();
    }
}

async function addItem(event) {
    event.preventDefault();
    
    const formData = new FormData();
    formData.append('name', document.getElementById('itemName').value);
    formData.append('description', document.getElementById('itemDescription').value);
    formData.append('price', document.getElementById('itemPrice').value);
    
    const imageFile = document.getElementById('itemImage').files[0];
    if (imageFile) {
        formData.append('image', imageFile);
    }
    
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/teacher/items`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Item added successfully!', 'success');
            closeModal();
            loadItems();
            loadTeacherDashboard();
        } else {
            showToast(data.error || 'Failed to add item', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

async function deleteStudent(studentId) {
    if (!confirm('Are you sure you want to delete this student? This action cannot be undone.')) {
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/teacher/students/${studentId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('Student deleted successfully', 'success');
            loadStudents();
            loadTeacherDashboard();
        } else {
            const data = await response.json();
            showToast(data.error || 'Failed to delete student', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

async function deleteItem(itemId) {
    if (!confirm('Are you sure you want to delete this item?')) {
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/teacher/items/${itemId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('Item deleted successfully', 'success');
            loadItems();
            loadTeacherDashboard();
        } else {
            const data = await response.json();
            showToast(data.error || 'Failed to delete item', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

async function downloadStatement(studentId) {
    try {
        const response = await fetch(`${API_BASE}/teacher/students/${studentId}/statement`);
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `student_statement_${studentId}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showToast('Statement downloaded successfully', 'success');
        } else {
            showToast('Failed to download statement', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    }
}

async function updateProfile(event) {
    event.preventDefault();
    
    const username = document.getElementById('profileUsername').value;
    const password = document.getElementById('profilePassword').value;
    
    const updateData = { username };
    if (password) {
        updateData.password = password;
    }
    
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/auth/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            document.getElementById('userName').textContent = currentUser.username;
            showToast('Profile updated successfully!', 'success');
            document.getElementById('profilePassword').value = '';
        } else {
            showToast(data.error || 'Failed to update profile', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

function updateTotalRevenue(purchases) {
    // purchases: array of {amount: number}
    const total = purchases.reduce((sum, p) => sum + p.amount, 0);
    document.getElementById('totalRevenue').textContent = `${total.toFixed(2)}`;
}

// Call updateTotalRevenue whenever purchases change
// updateTotalRevenue(purchasesArray);

// Example: update dashboard stats
function updateDashboardStats(data) {
    document.getElementById('totalRevenue').textContent = `${data.total_revenue.toFixed(2)}`;
    // ...other stats...
}

// Utility functions
function showLoading() {
    document.getElementById('loadingSpinner').classList.add('active');
}

function hideLoading() {
    document.getElementById('loadingSpinner').classList.remove('active');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.getElementById('toastContainer').appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// Close modal when clicking outside
document.getElementById('modalOverlay').addEventListener('click', function(event) {
    if (event.target === this) {
        closeModal();
    }
});

// Initialize cart count for students
if (currentStudent) {
    updateCartCount();
}

async function updateItem(event, itemId) {
    event.preventDefault();
    
    const name = document.getElementById('itemName').value;
    const description = document.getElementById('itemDescription').value;
    const price = parseFloat(document.getElementById('itemPrice').value);
    const imageFile = document.getElementById('itemImage').files[0];
    
    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    formData.append('price', price);
    if (imageFile) {
        formData.append('image', imageFile);
    }
    
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/teacher/items/${itemId}`, {
            method: 'PUT',
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Item updated successfully!', 'success');
            closeModal();
            loadItems();
        } else {
            showToast(data.error || 'Failed to update item', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}