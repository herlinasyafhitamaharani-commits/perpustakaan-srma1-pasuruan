import { db } from "./firebase-config.js";

import {
    collection,
    getDocs,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

let books = [];

async function loadBooks() {

    const snapshot = await getDocs(
        collection(db, "books")
    );

    books = snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
    }));

    showBooks(books);
}

function showBooks(data) {

    const container =
        document.getElementById("bookResults");

    container.innerHTML = "";

    if (data.length === 0) {
        container.textContent = "Buku tidak ditemukan.";
        return;
    }

    data.forEach(book => {

        const item = document.createElement("div");
        item.className = "book-item";

        const title = document.createElement("strong");
        title.textContent = book.title || "-";

        const author = document.createElement("small");
        author.textContent = "Penulis: " + (book.author || "-");

        const category = document.createElement("small");
        category.textContent = "Kategori: " + (book.category || "-");

        const stock = document.createElement("small");
        stock.textContent = "Stok tersedia: " + (book.available ?? 0);

        item.append(title, author, category, stock);
        container.appendChild(item);

    });
}

window.searchBooks = function() {

    const keyword = document
        .getElementById("searchBook")
        .value.toLowerCase()
        .trim();

    const filtered = books.filter(book => {

        return [
            book.title,
            book.author,
            book.category
        ].some(value =>
            String(value || "").toLowerCase().includes(keyword)
        );

    });

    showBooks(filtered);
};

async function loadProfile() {

    const ref = doc(db, "settings", "profile");

    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) return;

    const data = snapshot.data();

    document.getElementById("profilText").textContent =
        data.profile || "";

    document.getElementById("visiText").textContent =
        data.vision || "";

    document.getElementById("misiText").textContent =
        data.mission || "";

    document.getElementById("alamat").textContent =
        data.address || "";

    document.getElementById("telepon").textContent =
        data.phone || "";

    document.getElementById("email").textContent =
        data.email || "";

    const instagram =
        document.getElementById("instagram");

    instagram.textContent = data.instagram || "Instagram";
    instagram.href = data.instagramUrl || "#";
}

async function loadFAQ() {

    const snapshot = await getDocs(
        collection(db, "faqs")
    );

    const container = document.getElementById("faqList");

    container.innerHTML = "";

    snapshot.forEach(item => {

        const data = item.data();

        const details = document.createElement("details");
        const summary = document.createElement("summary");
        const answer = document.createElement("p");

        summary.textContent = data.question || "";
        answer.textContent = data.answer || "";

        details.append(summary, answer);
        container.appendChild(details);

    });
}

async function startWebsite() {

    try {

        await Promise.all([
            loadBooks(),
            loadProfile(),
            loadFAQ()
        ]);

    } catch (error) {

        console.error(error);

        document.getElementById("bookResults")
            .textContent =
            "Data belum dapat dimuat. Silakan coba kembali.";

    }
}

startWebsite();