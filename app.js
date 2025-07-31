const STORAGE_KEY = 'stokTakipCicekData';
const CRITICAL_DEFAULT = 10; // Kritik stok seviyesi
const API_BASE_URL = 'http://localhost:3000'; // Burayı kendi web sunucusu URL'nizle değiştireceksiniz.

const app = Vue.createApp({
  data() {
    return {
      page: 'products',
      theme: localStorage.getItem('theme') || 'light',
      products: [],
      stockMoves: [],
      sales: [],
      users: [], // Yeni: Kullanıcı verileri
      currentUser: null, // Yeni: Giriş yapan kullanıcı bilgisi
      loginUsername: '', // Yeni: Giriş ekranı kullanıcı adı
      loginPassword: '', // Yeni: Giriş ekranı şifresi
      isLoggedIn: false, // Yeni: Giriş yapılıp yapılmadığı
      showProductModal: false,
      showStockModal: false,
      showSaleModal: false,
      showWelcome: !localStorage.getItem('stokTakipCicekWelcome'),
      showHistoryModal: false,
      historyMoves: [],
      historyContentName: '',
      showImageModal: false, // Yeni eklendi
      currentImageUrl: '',    // Yeni eklendi
      editMode: false,
      productForm: {
        id: null,
        type: 'content',
        name: '',
        code: '',
        unit: '',
        stock: 0,
        critical: CRITICAL_DEFAULT,
        contents: [],
        imageUrl: '' // Yeni eklendi
      },
      stockForm: {
        contentId: '',
        type: 'giriş',
        amount: 1,
        note: ''
      },
      saleForm: {
        itemType: 'content',
        itemId: '',
        amount: 1,
        price: 0
      },
      stockSearch: '',
      charts: {
        contentSales: null,
        dailySales: null
      },
      saleSuccess: false, // satış sonrası bildirim
      importSuccess: false // içe aktarma bildirimi
    }
  },
  computed: {
    contents() {
      return this.products.filter(p => p.type === 'content');
    },
    bouquets() {
      return this.products.filter(p => p.type === 'product');
    },
    stockMovesSorted() {
      return [...this.stockMoves].sort((a, b) => b.date - a.date);
    },
    salesSorted() {
      return [...this.sales].sort((a, b) => b.date - a.date);
    },
    filteredContents() {
      const q = this.stockSearch.trim().toLowerCase();
      return this.contents
        .map(c => ({...c, critical: c.critical ?? CRITICAL_DEFAULT}))
        .filter(c => !q || c.name.toLowerCase().includes(q));
    }
  },
  mounted() {
    document.documentElement.setAttribute('data-theme', this.theme);
    // this.loadData(); // API'den yüklenecek
    this.checkLoginStatus(); // Giriş durumunu kontrol et
    this.$nextTick(this.renderCharts);
  },
  watch: {
    page(val) {
      if (val === 'reports') this.$nextTick(this.renderCharts);
    },
    // stockMoves: { handler() { this.saveData(); }, deep: true }, // API'ye göre güncellenecek
    // sales: { handler() { this.saveData(); }, deep: true }, // API'ye göre güncellenecek
    // products: { handler() { this.saveData(); }, deep: true }, // API'ye göre güncellenecek
    showWelcome(val) {
      if (!val) localStorage.setItem('stokTakipCicekWelcome', '1');
    },
    isLoggedIn(val) { // Giriş durumu değiştiğinde veriyi yükle
        if (val) {
            this.fetchInitialData();
        } else {
            this.products = [];
            this.stockMoves = [];
            this.sales = [];
            this.users = [];
        }
    }
  },
  methods: {
    // Yeni API metotları
    async fetchData(entity) {
      try {
        const response = await fetch(`${API_BASE_URL}/${entity}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        this[entity] = await response.json();
      } catch (error) {
        console.error(`Error fetching ${entity}:`, error);
        alert(`Veriler yüklenirken bir hata oluştu: ${entity}`);
      }
    },
    async postData(entity, data) {
      try {
        const response = await fetch(`${API_BASE_URL}/${entity}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
      } catch (error) {
        console.error(`Error posting ${entity}:`, error);
        alert(`Veri kaydedilirken bir hata oluştu: ${entity}`);
        return null;
      }
    },
    async putData(entity, id, data) {
      try {
        const response = await fetch(`${API_BASE_URL}/${entity}/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
      } catch (error) {
        console.error(`Error putting ${entity}:`, error);
        alert(`Veri güncellenirken bir hata oluştu: ${entity}`);
        return null;
      }
    },
    async deleteData(entity, id) {
      try {
        const response = await fetch(`${API_BASE_URL}/${entity}/${id}`, {
          method: 'DELETE'
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.ok;
      } catch (error) {
        console.error(`Error deleting ${entity}:`, error);
        alert(`Veri silinirken bir hata oluştu: ${entity}`);
        return false;
      }
    },
    // Giriş/Çıkış Metotları
    checkLoginStatus() {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            this.currentUser = JSON.parse(storedUser);
            this.isLoggedIn = true;
        }
    },
    async login() {
        await this.fetchData('users'); // Kullanıcıları çek

        if (this.users.length === 0) { // İlk giriş için varsayılan kullanıcıyı ekle
            await this.postData('users', { username: 'Avrasya', password: '123456', role: 'admin' });
            await this.fetchData('users'); // Yeni kullanıcıyı çek
        }

        const user = this.users.find(u => u.username === this.loginUsername && u.password === this.loginPassword);
        if (user) {
            this.currentUser = user;
            this.isLoggedIn = true;
            localStorage.setItem('currentUser', JSON.stringify(user));
            this.loginUsername = '';
            this.loginPassword = '';
            this.fetchInitialData();
        } else {
            alert('Geçersiz Kullanıcı Adı veya Şifre!');
        }
    },
    logout() {
        this.currentUser = null;
        this.isLoggedIn = false;
        localStorage.removeItem('currentUser');
        this.products = [];
        this.stockMoves = [];
        this.sales = [];
        this.users = [];
        this.page = 'products'; // Çıkış yapıldığında ürünler sayfasına dön
    },
    // Uygulama yüklendiğinde veya giriş yapıldığında ilk verileri çek
    async fetchInitialData() {
        await this.fetchData('products');
        await this.fetchData('stockMoves');
        await this.fetchData('sales');
    },
    // Tema geçişi
    toggleTheme() {
      this.theme = this.theme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', this.theme);
      localStorage.setItem('theme', this.theme);
    },
    // localStorage'dan veri yükle (API'ye göre güncellendi)
    async loadData() {
      // Bu fonksiyon artık doğrudan kullanılmayacak, fetchData metotları kullanılacak.
      this.products = [];
      this.stockMoves = [];
      this.sales = [];
    },
    // localStorage'a veri kaydet (API'ye göre güncellendi)
    async saveData() {
        // Bu metod artık kullanılmıyor, ilgili CRUD operasyonları API metotları üzerinden yapılacak.
    },
    // Verileri sıfırla (API'ye göre güncellendi)
    async resetAllData() {
      if (confirm('Tüm veriler silinecek. Emin misiniz? Bu işlem geri alınamaz!')) {
        // Tüm entity'leri sil
        await Promise.all([
            ...this.products.map(p => this.deleteData('products', p.id)),
            ...this.stockMoves.map(m => this.deleteData('stockMoves', m.id)),
            ...this.sales.map(s => this.deleteData('sales', s.id))
        ]);
        localStorage.removeItem(STORAGE_KEY);
        this.fetchInitialData(); // Verileri yeniden çek
        alert('Tüm veriler sıfırlandı!');
        location.reload();
      }
    },
    // Ürün ekle/düzenle işlemleri (API'ye göre güncellendi)
    showProductForm(type = 'content') {
      this.showProductModal = true;
      this.editMode = false;
      if (type === 'content') {
        this.productForm = {
          id: null, type: 'content', name: '', code: '', unit: '', stock: 0, critical: CRITICAL_DEFAULT, contents: [], imageUrl: ''
        };
      } else {
        this.productForm = {
          id: null, type: 'product', name: '', code: '', contents: [], imageUrl: ''
        };
      }
    },
    addContentToProduct() {
      this.productForm.contents.push({ contentId: '', amount: 1 });
    },
    removeContentFromProduct(i) {
      this.productForm.contents.splice(i, 1);
    },
    async saveProduct() { // async eklendi
      if (this.productForm.type === 'content') {
        if (this.editMode) {
          const updatedProduct = await this.putData('products', this.productForm.id, this.productForm);
          if (updatedProduct) {
            const idx = this.products.findIndex(p => p.id === updatedProduct.id);
            if (idx !== -1) this.products[idx] = updatedProduct;
          }
        } else {
          this.productForm.id = Date.now();
          const newProduct = await this.postData('products', this.productForm);
          if (newProduct) {
            this.products.push(newProduct);
          }
        }
      } else {
        this.productForm.contents = this.productForm.contents.filter(c => c.contentId && c.amount > 0);
        if (this.editMode) {
          const updatedProduct = await this.putData('products', this.productForm.id, this.productForm);
          if (updatedProduct) {
            const idx = this.products.findIndex(p => p.id === updatedProduct.id);
            if (idx !== -1) this.products[idx] = updatedProduct;
          }
        } else {
          this.productForm.id = Date.now();
          const newProduct = await this.postData('products', this.productForm);
          if (newProduct) {
            this.products.push(newProduct);
          }
        }
      }
      this.closeProductModal();
    },
    editProduct(product) {
      this.productForm = JSON.parse(JSON.stringify(product));
      this.showProductModal = true;
      this.editMode = true;
    },
    copyProduct(product) {
      const copy = JSON.parse(JSON.stringify(product));
      copy.id = Date.now();
      copy.code = '';
      copy.name += ' (Kopya)';
      this.productForm = copy;
      this.showProductModal = true;
      this.editMode = false;
    },
    async deleteProduct(id) { // async eklendi
      if (confirm('Silmek istediğinize emin misiniz?')) {
        const success = await this.deleteData('products', id);
        if (success) {
          this.products = this.products.filter(p => p.id !== id);
        }
      }
    },
    closeProductModal() {
      this.showProductModal = false;
    },
    // İçerik adı ve birimi getir
    getContentName(contentId) {
      const c = this.contents.find(c => c.id == contentId);
      return c ? c.name : '';
    },
    getContentUnit(contentId) {
      const c = this.contents.find(c => c.id == contentId);
      return c ? c.unit : '';
    },
    // Ürün adı ve kodu getir
    getProductName(productId) {
      const p = this.products.find(p => p.id == productId);
      return p ? p.name : '';
    },
    getProductCode(productId) {
      const p = this.products.find(p => p.id == productId);
      return p ? p.code : '';
    },
    // Stok geçmişi modalı
    showContentHistory(content) {
      this.historyContentName = content.name;
      this.historyMoves = this.stockMovesSorted.filter(m => m.contentId == content.id);
      this.showHistoryModal = true;
    },
    // Tarih formatla
    formatDate(ts) {
      const d = new Date(ts);
      return d.toLocaleDateString('tr-TR') + ' ' + d.toLocaleTimeString('tr-TR', {hour: '2-digit', minute: '2-digit'});
    },
    // Resim büyütme modalını göster
    showLargeImage(url) {
      this.currentImageUrl = url;
      this.showImageModal = true;
    },
    // Stok hareketi işlemleri (sadece içerik ürünleri) (API'ye göre güncellendi)
    async saveStockMove() { // async eklendi
      if (!this.stockForm.contentId || !this.stockForm.type || !this.stockForm.amount) return;
      const move = {
        ...this.stockForm,
        id: Date.now(),
        date: Date.now()
      };
      // Stok güncelle
      const c = this.contents.find(c => c.id == move.contentId);
      if (!c) return;
      let updatedStock = c.stock;
      if (move.type === 'giriş') updatedStock += move.amount;
      else if (move.type === 'çıkış') updatedStock = Math.max(0, updatedStock - move.amount);
      else if (move.type === 'sayım') updatedStock = move.amount;

      const updatedContent = await this.putData('products', c.id, { ...c, stock: updatedStock });
      if (updatedContent) {
        const newMove = await this.postData('stockMoves', move);
        if (newMove) {
          this.stockMoves.push(newMove);
        }
      }
      this.showStockModal = false;
      this.stockForm = { contentId: '', type: 'giriş', amount: 1, note: '' };
    },
    // Satış işlemleri (hem içerik ürünü hem ürün) (API'ye göre güncellendi)
    async saveSale() { // async eklendi
      if (!this.saleForm.itemType || !this.saleForm.itemId || !this.saleForm.amount || !this.saleForm.price) return;
      const sale = {
        ...this.saleForm,
        id: Date.now(),
        date: Date.now(),
        total: this.saleForm.amount * this.saleForm.price
      };
      let stokDusuruldu = false;
      const stockMovesToPost = [];
      const productsToUpdate = [];

      if (sale.itemType === 'content') {
        // İçerik ürünü satışı
        const c = this.contents.find(c => c.id == sale.itemId);
        if (!c) return;
        const dusulecek = Math.min(sale.amount, c.stock);
        const updatedStock = c.stock - dusulecek;

        productsToUpdate.push({ id: c.id, data: { ...c, stock: updatedStock } });

        stockMovesToPost.push({
          id: Date.now() + Math.random(),
          contentId: c.id,
          type: 'çıkış',
          amount: dusulecek,
          note: 'Satış',
          date: sale.date
        });
        stokDusuruldu = dusulecek > 0;
      } else {
        // Ürün/buket satışı
        const p = this.bouquets.find(p => p.id == sale.itemId);
        if (!p) return;
        let yeterliStok = true;
        // Önce stok yeterliliği kontrolü
        p.contents.forEach(content => {
          const c = this.contents.find(x => x.id == content.contentId);
          if (!c || c.stock < sale.amount * content.amount) yeterliStok = false;
        });
        if (!yeterliStok) {
          alert('Stok yetersiz!');
          return;
        }
        p.contents.forEach(content => {
          const c = this.contents.find(x => x.id == content.contentId);
          if (c) {
            const totalAmount = sale.amount * content.amount;
            const updatedStock = c.stock - totalAmount;

            productsToUpdate.push({ id: c.id, data: { ...c, stock: updatedStock } });

            stockMovesToPost.push({
              id: Date.now() + Math.random(),
              contentId: c.id,
              type: 'çıkış',
              amount: totalAmount,
              note: 'Satış (Buket)',
              date: sale.date
            });
          }
        });
        stokDusuruldu = true;
      }
      if (stokDusuruldu) {
        // Ürünleri güncelle
        await Promise.all(productsToUpdate.map(item => this.putData('products', item.id, item.data)));
        // Stok hareketlerini kaydet
        await Promise.all(stockMovesToPost.map(move => this.postData('stockMoves', move)));

        const newSale = await this.postData('sales', sale);
        if (newSale) {
          this.sales.push(newSale);
          this.saleSuccess = true;
          setTimeout(() => { this.saleSuccess = false; }, 2000);
        }
      }
      this.showSaleModal = false;
      this.saleForm = { itemType: 'content', itemId: '', amount: 1, price: 0 };
    },
    // Export fonksiyonu (API'ye göre güncellendi - sadece formatlama)
    async exportData(type) { // async eklendi
      // Verileri API'den çekerek export et
      const products = await (await fetch(`${API_BASE_URL}/products`)).json();
      const stockMoves = await (await fetch(`${API_BASE_URL}/stockMoves`)).json();
      const sales = await (await fetch(`${API_BASE_URL}/sales`)).json();

      const data = {
        products: products,
        stockMoves: stockMoves,
        sales: sales
      };
      if (type === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'stoktakipcicek.json';
        a.click();
        URL.revokeObjectURL(url);
      } else if (type === 'csv') {
        let csv = 'Tip,Tarih,Çiçek Türü,Ürün,Ürün Kodu,Miktar,Birim,Tutar,Açıklama\n';
        sales.forEach(s => {
          let name = '', code = '', unit = '', cName = '';
          if (s.itemType === 'content') {
            const c = products.filter(p => p.type === 'content').find(x => x.id == s.itemId);
            cName = c ? c.name : '';
            unit = c ? c.unit : '';
          } else {
            const p = products.filter(p => p.type === 'product').find(x => x.id == s.itemId);
            name = p ? p.name : '';
            code = p ? p.code : '';
          }
          csv += `Satış,${this.formatDate(s.date)},${cName},${name},${code},${s.amount},${unit},${s.total},\n`;
        });
        stockMoves.forEach(m => {
          const c = products.filter(p => p.type === 'content').find(x => x.id == m.contentId);
          csv += `Stok,${this.formatDate(m.date)},${c ? c.name : ''},,,${m.amount},${c ? c.unit : ''},,${m.note}\n`;
        });
        const blob = new Blob([csv], {type: 'text/csv'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'stoktakipcicek.csv';
        a.click();
        URL.revokeObjectURL(url);
      }
    },
    // İçe Aktırma fonksiyonu (API'ye göre güncellendi)
    async importData(event) { // async eklendi
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (e) => { // async eklendi
        try {
          const data = JSON.parse(e.target.result);
          if (data.products && data.stockMoves && data.sales) {
            // Tüm eski verileri sil
            // API'den veri silme işlemi `resetAllData` içinde yapılmalı.
            // Sadece Vue state'ini temizleyelim ve sonra API'ye yeni verileri gönderelim.
            this.products = [];
            this.stockMoves = [];
            this.sales = [];

            // Yeni verileri kaydet
            await Promise.all(data.products.map(p => this.postData('products', p)));
            await Promise.all(data.stockMoves.map(m => this.postData('stockMoves', m)));
            await Promise.all(data.sales.map(s => this.postData('sales', s)));

            this.importSuccess = true;
            setTimeout(() => { this.importSuccess = false; }, 2000);
            setTimeout(() => { location.reload(); }, 1200);
          } else {
            alert('Geçersiz veri dosyası!');
          }
        } catch (err) {
          alert('Dosya okunamadı veya bozuk!');
          console.error(err);
        }
      };
      reader.readAsText(file);
    },
    // Chart.js ile grafik çiz
    renderCharts() {
      if (this.charts.contentSales) this.charts.contentSales.destroy();
      const contentLabels = this.contents.map(c => c.name);
      const contentTotals = this.contents.map(c => {
        let total = 0;
        this.sales.forEach(sale => {
          if (sale.itemType === 'content' && sale.itemId == c.id) {
            total += sale.amount;
          } else if (sale.itemType === 'product') {
            const p = this.bouquets.find(p => p.id == sale.itemId);
            if (p) {
              const content = p.contents.find(x => x.contentId == c.id);
              if (content) total += sale.amount * content.amount;
            }
          }
        });
        return total;
      });
      const ctx1 = document.getElementById('contentSalesChart');
      if (ctx1) {
        this.charts.contentSales = new Chart(ctx1, {
          type: 'bar',
          data: {
            labels: contentLabels,
            datasets: [{ label: 'Satış Adedi', data: contentTotals, backgroundColor: '#4caf50' }]
          },
          options: { responsive: true, plugins: { legend: { display: false } } }
        });
      }
      if (this.charts.dailySales) this.charts.dailySales.destroy();
      const daily = {};
      this.sales.forEach(s => {
        daily[this.formatDate(s.date).split(' ')[0]] = (daily[this.formatDate(s.date).split(' ')[0]] || 0) + s.total;
      });
      const days = Object.keys(daily).sort();
      const totals = days.map(d => daily[d]);
      const ctx2 = document.getElementById('dailySalesChart');
      if (ctx2) {
        this.charts.dailySales = new Chart(ctx2, {
          type: 'line',
          data: {
            labels: days,
            datasets: [{ label: 'Günlük Satış (₺)', data: totals, borderColor: '#4caf50', fill: false }]
          },
          options: { responsive: true, plugins: { legend: { display: true } } }
        });
      }
    },
    // Yeni kullanıcı yönetimi metodları
    async addUser() {
        const newUsername = prompt('Yeni kullanıcı adı:');
        const newPassword = prompt('Yeni şifre:');
        const newRole = prompt('Rol (admin/user):', 'user');
        if (newUsername && newPassword) {
            const newUser = await this.postData('users', { id: Date.now(), username: newUsername, password: newPassword, role: newRole });
            if (newUser) {
                this.users.push(newUser);
                alert('Kullanıcı başarıyla eklendi!');
            }
        }
    },
    async deleteUser(id) {
        if (confirm('Kullanıcıyı silmek istediğinize emin misiniz?')) {
            const success = await this.deleteData('users', id);
            if (success) {
                this.users = this.users.filter(u => u.id !== id);
                alert('Kullanıcı başarıyla silindi!');
            }
        }
    },
    isAdmin() {
        return this.currentUser && this.currentUser.role === 'admin';
    }
  },
  filters: {
    currency(val) {
      return Number(val).toLocaleString('tr-TR', {style: 'currency', currency: 'TRY'});
    }
  }
});
app.mount('#app');