const fs = require('fs');

const path = 'C:/Users/patio/Downloads/backup_catalogo.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const getCategory = (name) => {
    const l = name.toLowerCase();
    
    // Labiales y Gloss
    if (l.includes('gloss') || l.includes('tinta') || l.includes('labial')) {
        return 'Labiales & Gloss 💄';
    }
    // Perfumería
    if (l.includes('sol de janeiro') || l.includes('perfume') || l.includes('splash') || l.includes('moschino') || l.includes('candy') || l.includes('dior')) {
        return 'Perfumería & Splash ✨';
    }
    // Bolsos y Billeteras
    if (l.includes('billetera') || l.includes('cosmetiquera') || l.includes('manos libres') || l.includes('bolso') || l.includes('riñonera') || l.includes('bimba y lola') || l.includes('coach') || l.includes('prada') || l.includes('steve')) {
        return 'Bolsos & Billeteras 👜';
    }
    // Termos y Variedad Electronica/Hogar
    if (l.includes('stanley') || l.includes('termo') || l.includes('vaso') || l.includes('jarra')) {
        return 'Termos & Vasos 🥤';
    }
    if (l.includes('ventilador')) {
        return 'Tecnología & Gadgets 🌬️';
    }
    // Maquillaje de rostro
    if (l.includes('iluminador') || l.includes('rubor') || l.includes('crema') || l.includes('skincare')) {
        return 'Maquillaje & Cuidado Facial 💖';
    }
    // Accesorios
    if (l.includes('caimanes')) {
        return 'Accesorios para Cabello 🎀';
    }
    if (l.includes('medias')) {
        return 'Ropa & Medias 🧦';
    }
    // Otros
    if (l.includes('juego') || l.includes('cuchillos') || l.includes('cepillo') || l.includes('secador')) {
        return 'Hogar & Variedades 📦';
    }

    return 'Otros Accesorios 🎁';
};

let modified = 0;
for (let d of data) {
    const suggested = getCategory(d.name);
    d.category = suggested;
    modified++;
}

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log(`Categorizadas con éxito ${modified} productos.`);
