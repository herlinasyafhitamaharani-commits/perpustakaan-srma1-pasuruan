import { auth, db } from "./firebase-config.js";

import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    getDoc,
    setDoc,
    query,
    where,
    orderBy,
    runTransaction,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// GANTI DENGAN UID ADMIN DARI FIREBASE AUTH
const ADMIN_UID = "TIQbJCgmJcci3iHHCzVoJitaGRD2";

let books = [];
let transactions = [];
let faqs = [];

const $ = id => document.getElementById(id);

function message(text) {
    alert(text);
}

function today() {
    return new Date().toISOString().slice(0, 10);
}

// LOGIN ADMIN
$("loginButton").onclick = async () => {

    try {

        await signInWithEmailAndPassword(
            auth,
            $("loginEmail").value.trim(),
            $("loginPassword").value
        );

    } catch (error) {

        $("loginMessage").textContent =
            "Login gagal. Periksa email dan password.";

        console.error(error);

    }

};

// PEMERIKSAAN AKUN
onAuthStateChanged(auth, async user => {

    if (!user) {

        $("loginArea").classList.remove("hidden");
        $("dashboard").classList.add("hidden");

        return;

    }

    if (user.uid !== ADMIN_UID) {

        await signOut(auth);

        message("Akun ini tidak memiliki akses admin.");

        return;

    }

    $("loginArea").classList.add("hidden");
    $("dashboard").classList.remove("hidden");

    $("adminEmail").textContent = user.email;

    await loadAll();

});

// LOGOUT
$("logoutButton").onclick = async () => {
    await signOut(auth);
};

// MEMUAT DATA
async function loadAll() {

    await Promise.all([
        loadBooks(),
        loadTransactions(),
        loadProfile(),
        loadFAQs()
    ]);

    updateDashboard();
    renderReports();

}

// DATA BUKU
async function loadBooks() {

    const snapshot = await getDocs(
        collection(db, "books")
    );

    books = snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
    }));

    renderBooks();
    renderBookOptions();

}

function renderBooks() {

    $("bookTable").innerHTML = "";

    books.forEach(book => {

        const row = document.createElement("tr");

        const title = document.createElement("td");
        title.textContent = book.title || "";

        const author = document.createElement("td");
        author.textContent = book.author || "";

        const stock = document.createElement("td");
        stock.textContent = `${book.available ?? 0}/${book.stock ?? 0}`;

        const action = document.createElement("td");

        const edit = document.createElement("button");
        edit.textContent = "Edit";

        edit.onclick = () => editBook(book.id);

        const remove = document.createElement("button");
        remove.textContent = "Hapus";

        remove.onclick = () => deleteBook(book.id);

        action.append(edit, remove);

        row.append(title, author, stock, action);

        $("bookTable").appendChild(row);

    });

}

function renderBookOptions() {

    $("borrowBook").innerHTML =
        '<option value="">Pilih buku</option>';

    books.forEach(book => {

        const option = document.createElement("option");

        option.value = book.id;

        option.textContent =
            `${book.title} (tersedia: ${book.available ?? 0})`;

        option.disabled = (book.available ?? 0) <= 0;

        $("borrowBook").appendChild(option);

    });

}

// SIMPAN ATAU EDIT BUKU
$("saveBook").onclick = async () => {

    const id = $("bookId").value;

    const title = $("bookTitle").value.trim();
    const author = $("bookAuthor").value.trim();
    const category = $("bookCategory").value.trim();
    const isbn = $("bookISBN").value.trim();

    const stock = Number($("bookStock").value);

    if (!title || !author || !category ||
        $("bookStock").value === "" ||
        !Number.isSafeInteger(stock) || stock < 0) {

        message("Lengkapi data buku dengan benar.");
        return;

    }

    try {

        if (id) {

            const existing = books.find(book => book.id === id);

            if (!existing) return;

            const borrowed =
                (existing.stock || 0) - (existing.available || 0);

            if (stock < borrowed) {
                message("Stok tidak boleh lebih kecil dari jumlah buku yang sedang dipinjam.");
                return;
            }

            await updateDoc(doc(db, "books", id), {

                title,
                author,
                category,
                isbn,
                stock,
                available: stock - borrowed

            });

        } else {

            await addDoc(collection(db, "books"), {

                title,
                author,
                category,
                isbn,
                stock,
                available: stock,
                createdAt: serverTimestamp()

            });

        }

        resetBookForm();
        await loadBooks();
        updateDashboard();

        message("Data buku berhasil disimpan.");

    } catch (error) {

        console.error(error);
        message("Gagal menyimpan buku.");

    }

};

function editBook(id) {

    const book = books.find(item => item.id === id);

    if (!book) return;

    $("bookId").value = book.id;
    $("bookTitle").value = book.title || "";
    $("bookAuthor").value = book.author || "";
    $("bookCategory").value = book.category || "";
    $("bookISBN").value = book.isbn || "";
    $("bookStock").value = book.stock ?? 0;

    window.scrollTo(0, 0);

}

function resetBookForm() {

    [
        "bookId",
        "bookTitle",
        "bookAuthor",
        "bookCategory",
        "bookISBN",
        "bookStock"
    ].forEach(id => $(id).value = "");

}

$("resetBook").onclick = resetBookForm;

// HAPUS BUKU
async function deleteBook(id) {

    const book = books.find(item => item.id === id);

    if (!book) return;

    const borrowed =
        (book.stock || 0) - (book.available || 0);

    if (borrowed > 0) {
        message("Buku tidak dapat dihapus karena masih dipinjam.");
        return;
    }

    if (!confirm("Hapus buku ini?")) return;

    try {

        await deleteDoc(doc(db, "books", id));

        await loadBooks();
        updateDashboard();

        message("Buku berhasil dihapus.");

    } catch (error) {

        console.error(error);
        message("Gagal menghapus buku.");

    }

}

// TRANSAKSI PEMINJAMAN
$("borrowDate").value = today();

$("saveBorrow").onclick = async () => {

    const name = $("studentName").value.trim();
    const studentClass = $("studentClass").value.trim();
    const bookId = $("borrowBook").value;
    const borrowDate = $("borrowDate").value;
    const dueDate = $("dueDate").value;

    if (!name || !studentClass || !bookId ||
        !borrowDate || !dueDate) {

        message("Lengkapi semua data peminjaman.");
        return;

    }

    if (dueDate < borrowDate) {
        message("Tanggal jatuh tempo tidak boleh sebelum tanggal pinjam.");
        return;
    }

    try {

        await runTransaction(db, async transaction => {

            const bookRef = doc(db, "books", bookId);

            const bookSnap = await transaction.get(bookRef);

            if (!bookSnap.exists()) {
                throw new Error("Buku tidak ditemukan.");
            }

            const book = bookSnap.data();

            if ((book.available || 0) <= 0) {
                throw new Error("Stok buku habis.");
            }

            const loanRef = doc(collection(db, "transactions"));

            transaction.update(bookRef, {

                available: book.available - 1

            });

            transaction.set(loanRef, {

                studentName: name,
                studentClass,
                bookId,
                bookTitle: book.title,
                borrowDate,
                dueDate,
                returnDate: "",
                status: "Dipinjam",
                createdAt: serverTimestamp()

            });

        });

        $("studentName").value = "";
        $("studentClass").value = "";
        $("borrowBook").value = "";

        await loadAll();

        message("Peminjaman berhasil dicatat.");

    } catch (error) {

        console.error(error);
        message(error.message || "Peminjaman gagal.");

    }

};

// MEMUAT TRANSAKSI
async function loadTransactions() {

    const snapshot = await getDocs(
        query(
            collection(db, "transactions"),
            orderBy("borrowDate", "desc")
        )
    );

    transactions = snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
    }));

    renderTransactions();

}

function renderTransactions() {

    $("transactionTable").innerHTML = "";

    transactions.forEach(item => {

        const row = document.createElement("tr");

        [
            item.studentName,
            item.studentClass,
            item.bookTitle,
            item.borrowDate,
            item.dueDate,
            item.status
        ].forEach(value => {

            const cell = document.createElement("td");
            cell.textContent = value || "-";
            row.appendChild(cell);

        });

        const action = document.createElement("td");

        if (item.status === "Dipinjam") {

            const button = document.createElement("button");

            button.textContent = "Kembalikan";

            button.onclick = () => returnBook(item.id);

            action.appendChild(button);

        } else {

            action.textContent = "Selesai";

        }

        row.appendChild(action);

        $("transactionTable").appendChild(row);

    });

}

// PENGEMBALIAN BUKU
async function returnBook(id) {

    if (!confirm("Catat pengembalian buku ini?")) return;

    try {

        await runTransaction(db, async transaction => {

            const loanRef = doc(db, "transactions", id);

            const loanSnap = await transaction.get(loanRef);

            if (!loanSnap.exists()) {
                throw new Error("Transaksi tidak ditemukan.");
            }

            const loan = loanSnap.data();

            if (loan.status !== "Dipinjam") {
                throw new Error("Buku sudah dikembalikan.");
            }

            const bookRef = doc(db, "books", loan.bookId);

            const bookSnap = await transaction.get(bookRef);

            if (!bookSnap.exists()) {
                throw new Error("Data buku tidak ditemukan.");
            }

            const book = bookSnap.data();

            transaction.update(bookRef, {

                available: book.available + 1

            });

            transaction.update(loanRef, {

                status: "Dikembalikan",
                returnDate: today()

            });

        });

        await loadAll();

        message("Pengembalian berhasil dicatat.");

    } catch (error) {

        console.error(error);
        message(error.message || "Pengembalian gagal.");

    }

}

// DASHBOARD
function updateDashboard() {

    $("totalBooks").textContent = books.length;

    $("totalStock").textContent =
        books.reduce((sum, book) =>
            sum + (Number(book.stock) || 0), 0);

    $("totalBorrowed").textContent =
        transactions.filter(item =>
            item.status === "Dipinjam").length;

}

// PROFIL
async function loadProfile() {

    const ref = doc(db, "settings", "profile");

    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) return;

    const data = snapshot.data();

    $("editProfile").value = data.profile || "";
    $("editVision").value = data.vision || "";
    $("editMission").value = data.mission || "";
    $("editAddress").value = data.address || "";
    $("editPhone").value = data.phone || "";
    $("editEmail").value = data.email || "";
    $("editInstagram").value = data.instagram || "";
    $("editInstagramUrl").value = data.instagramUrl || "";

}

$("saveProfile").onclick = async () => {

    try {

        await setDoc(doc(db, "settings", "profile"), {

            profile: $("editProfile").value,
            vision: $("editVision").value,
            mission: $("editMission").value,
            address: $("editAddress").value,
            phone: $("editPhone").value,
            email: $("editEmail").value,
            instagram: $("editInstagram").value,
            instagramUrl: $("editInstagramUrl").value

        });

        message("Profil berhasil diperbarui.");

    } catch (error) {

        console.error(error);
        message("Gagal menyimpan profil.");

    }

};

// FAQ
async function loadFAQs() {

    const snapshot = await getDocs(
        collection(db, "faqs")
    );

    faqs = snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
    }));

    renderFAQs();

}

function renderFAQs() {

    $("adminFAQ").innerHTML = "";

    faqs.forEach(item => {

        const wrapper = document.createElement("div");

        const question = document.createElement("p");
        question.textContent = item.question;

        const answer = document.createElement("p");
        answer.textContent = item.answer;

        const button = document.createElement("button");
        button.textContent = "Hapus";

        button.onclick = async () => {

            if (!confirm("Hapus FAQ ini?")) return;

            await deleteDoc(doc(db, "faqs", item.id));

            await loadFAQs();

        };

        wrapper.append(question, answer, button);

        $("adminFAQ").appendChild(wrapper);

    });

}

$("saveFAQ").onclick = async () => {

    const question = $("faqQuestion").value.trim();
    const answer = $("faqAnswer").value.trim();

    if (!question || !answer) {
        message("Isi pertanyaan dan jawaban.");
        return;
    }

    try {

        await addDoc(collection(db, "faqs"), {
            question,
            answer,
            createdAt: serverTimestamp()
        });

        $("faqQuestion").value = "";
        $("faqAnswer").value = "";

        await loadFAQs();

        message("FAQ berhasil ditambahkan.");

    } catch (error) {

        console.error(error);
        message("Gagal menambahkan FAQ.");

    }

};

// LAPORAN
function renderReports() {

    const start = $("reportStart").value;
    const end = $("reportEnd").value;

    const filtered = transactions.filter(item => {

        return (
            (!start || item.borrowDate >= start) &&
            (!end || item.borrowDate <= end)
        );

    });

    $("reportSummary").textContent =
        "Jumlah transaksi: " + filtered.length +
        " | Dipinjam: " +
        filtered.filter(x => x.status === "Dipinjam").length +
        " | Dikembalikan: " +
        filtered.filter(x => x.status === "Dikembalikan").length;

    return filtered;

}

$("reportStart").onchange = renderReports;
$("reportEnd").onchange = renderReports;

$("printReport").onclick = () => {

    renderReports();

    window.print();

};

$("exportReport").onclick = () => {

    const data = renderReports();

    const columns = [
        "Nama Siswa",
        "Kelas",
        "Judul Buku",
        "Tanggal Pinjam",
        "Jatuh Tempo",
        "Tanggal Kembali",
        "Status"
    ];

    const escapeCSV = value =>
        '"' + String(value ?? "").replace(/"/g, '""') + '"';

    const rows = data.map(item => [

        item.studentName,
        item.studentClass,
        item.bookTitle,
        item.borrowDate,
        item.dueDate,
        item.returnDate,
        item.status

    ]);

    const csv = "\uFEFF" +
        [columns, ...rows]
        .map(row => row.map(escapeCSV).join(","))
        .join("\r\n");

    const blob = new Blob(
        [csv],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "laporan-perpustakaan.csv";

    link.click();

    URL.revokeObjectURL(url);

};