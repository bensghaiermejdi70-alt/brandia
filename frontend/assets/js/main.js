// Injection header/footer
fetch("components/header.html").then(r => r.text()).then(html => document.getElementById("header").innerHTML = html);
fetch("components/footer.html").then(r => r.text()).then(html => document.getElementById("footer").innerHTML = html);

// Marques & produits en vedette (placeholder)
const brands = [
  {name:"GlowCo",  img:"https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0&auto=format&fit=crop&w=200&q=80"},
  {name:"Sportix", img:"https://images.unsplash.com/photo-1517963879433-6ad2b056d712?ixlib=rb-4.0&auto=format&fit=crop&w=200&q=80"},
  {name:"Beauty+", img:"https://images.unsplash.com/photo-1556228578-8c89e6adf883?ixlib=rb-4.0&auto=format&fit=crop&w=200&q=80"},
  {name:"HomeLab", img:"https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0&auto=format&fit=crop&w=200&q=80"},
  {name:"ZenLife", img:"https://images.unsplash.com/photo-1556909114-1b23b960d5a8?ixlib=rb-4.0&auto=format&fit=crop&w=200&q=80"}
];
document.getElementById("brands-bar").innerHTML = brands.map(b =>
  `<a href="brand.html?id=1" class="shrink-0 flex items-center space-x-2 px-3 py-1 bg-neutral-800 rounded hover:bg-neutral-700">
    <img src="${b.img}" alt="${b.name}" class="h-12 w-12 rounded"><span class="text-neutral-200 text-xs">${b.name}</span>
  </a>`
).join("");

const products = [
  {name:"Sérum Hydratant", price:"22,90 €", img:"https://images.unsplash.com/photo-1556228578-8c89e6adf883?ixlib=rb-4.0&auto=format&fit=crop&w=400&q=80"},
  {name:"Crème Anti-Âge",  price:"38,90 €", img:"https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0&auto=format&fit=crop&w=400&q=80"},
  {name:"Masque Capillaire", price:"19,90 €", img:"https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0&auto=format&fit=crop&w=400&q=80"},
  {name:"Gel Nettoyant",   price:"14,90 €", img:"https://images.unsplash.com/photo-1517963879433-6ad2b056d712?ixlib=rb-4.0&auto=format&fit=crop&w=400&q=80"},
  {name:"Huile Sèche",     price:"26,90 €", img:"https://images.unsplash.com/photo-1556909114-1b23b960d5a8?ixlib=rb-4.0&auto=format&fit=crop&w=400&q=80"}
];
document.getElementById("products-grid").innerHTML = products.map(p =>
  `<div class="block bg-neutral-800 rounded p-3 ring-1 ring-neutral-700 hover:ring-indigo-400 transition">
    <img src="${p.img}" alt="${p.name}" class="w-full h-32 object-cover rounded mb-2">
    <p class="text-sm text-neutral-100 truncate">${p.name}</p>
    <p class="font-bold text-indigo-400">${p.price}</p>
  </div>`
).join("");