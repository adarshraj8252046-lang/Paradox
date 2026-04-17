// Initialize Icons
lucide.createIcons();

// --- Navigation Logic (SPA) ---
const navLinks = document.querySelectorAll('.nav-links a');
const sections = document.querySelectorAll('.page-section');

function navigateTo(targetId) {
  // Update links
  navLinks.forEach(link => {
    if (link.dataset.target === targetId) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Update sections
  sections.forEach(section => {
    if (section.id === targetId) {
      section.classList.add('active-section');
    } else {
      section.classList.remove('active-section');
    }
  });
  window.scrollTo(0, 0);
}

navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo(link.dataset.target);
  });
});

// CTA Buttons on Home
document.getElementById('btn-start-check').addEventListener('click', () => navigateTo('eligibility-section'));
document.getElementById('btn-view-schemes').addEventListener('click', () => navigateTo('schemes-section'));


// --- Helper Rendering Functions ---

function createSchemeCard(scheme, forResult = false) {
  const div = document.createElement('div');
  div.className = 'scheme-card';
  
  const benefitsHtml = scheme.benefits.map(b => `<li>${b}</li>`).join('');
  
  div.innerHTML = `
    <span class="badge">${scheme.category}</span>
    <h4>${scheme.name}</h4>
    <p>${scheme.description}</p>
    <ul class="scheme-benefits">
      ${benefitsHtml}
    </ul>
    <button class="btn btn-primary btn-block btn-apply">Find NGO Help</button>
  `;

  // Attach event listener to Apply button
  div.querySelector('.btn-apply').addEventListener('click', () => {
    navigateTo('ngos-section');
  });

  return div;
}

function renderAllSchemes() {
  const container = document.getElementById('all-schemes-grid');
  container.innerHTML = '';
  mockData.schemes.forEach(scheme => {
    container.appendChild(createSchemeCard(scheme));
  });
}

function renderNGOs() {
  const container = document.getElementById('ngo-grid');
  const selectModal = document.getElementById('modal-scheme-select');
  
  container.innerHTML = '';
  selectModal.innerHTML = '';

  // Populate global scheme dropdown for modal
  mockData.schemes.forEach(scheme => {
    selectModal.innerHTML += `<option value="${scheme.name}">${scheme.name}</option>`;
  });

  mockData.ngos.forEach(ngo => {
    const div = document.createElement('div');
    div.className = 'ngo-card';
    
    // Select a random review as featured
    const review = ngo.reviews[0];

    div.innerHTML = `
      <div class="ngo-header">
        <h4>${ngo.name}</h4>
        <span class="star-rating"><i data-lucide="star" fill="#F59E0B"></i> ${ngo.rating}</span>
      </div>
      <div class="ngo-meta"><i data-lucide="tag" class="icon-primary"></i> ${ngo.area}</div>
      <div class="ngo-meta"><i data-lucide="map" class="icon-primary"></i> ${ngo.location}</div>
      <div class="ngo-distance"><i data-lucide="navigation" class="icon-blue"></i> ${ngo.distance} from you</div>
      
      <div class="reviews-preview mt-3">
        <span>" ${review.text} "</span>
        - ${review.user}
      </div>

      <button class="btn btn-secondary btn-block req-help-btn" data-ngoid="${ngo.id}" data-ngoname="${ngo.name}">Request Help</button>
    `;
    container.appendChild(div);
  });
  
  // Re-init lucide icons for newly added DOM
  lucide.createIcons();

  // Attach modal triggers
  document.querySelectorAll('.req-help-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      openHelpModal(e.target.dataset.ngoid, e.target.dataset.ngoname);
    });
  });
}

function renderStories() {
  const container = document.getElementById('stories-grid');
  container.innerHTML = '';
  
  mockData.stories.forEach(story => {
    const div = document.createElement('div');
    div.className = 'story-card glass-card';
    div.innerHTML = `
      <div class="story-avatar"><i data-lucide="user" size="32"></i></div>
      <q>${story.story}</q>
      <div class="story-author">${story.name}</div>
      <div class="story-scheme">Beneficiary: ${story.scheme}</div>
    `;
    container.appendChild(div);
  });
  lucide.createIcons();
}

// --- Eligibility Engine Engine ---

document.getElementById('eligibility-form').addEventListener('submit', (e) => {
  e.preventDefault();
  
  const age = parseInt(document.getElementById('form-age').value);
  const income = parseInt(document.getElementById('form-income').value);
  const category = document.getElementById('form-category').value;
  const gender = document.getElementById('form-gender').value;
  const occupation = document.getElementById('form-occupation').value;
  const disability = document.getElementById('form-disability').value;

  // Matching Logic
  const matches = mockData.schemes.filter(scheme => {
    const el = scheme.eligibility;
    
    // Check Income
    if (income > el.maxIncome) return false;
    
    // Check Age
    if (age < el.ageMin || age > el.ageMax) return false;

    // Check Category
    if (!el.categories.includes('All') && !el.categories.includes(category) && !el.categories.includes('General')) {
      if (!el.categories.includes(category)) return false;
    }

    // Check Gender
    if (el.gender && el.gender !== gender) return false;

    // Check Occupation
    if (el.occupation && el.occupation !== occupation) return false;

    // Check Disability
    if (el.disability === 'yes' && disability !== 'yes') return false;

    return true;
  });

  // Render Results
  const resultsGrid = document.getElementById('results-grid');
  resultsGrid.innerHTML = '';
  document.getElementById('match-count').innerText = matches.length;

  if (matches.length === 0) {
    resultsGrid.innerHTML = `<p class="placeholder-text" style="color:red;">No exact schemes found for this profile. Try checking the "All Schemes" directory.</p>`;
  } else {
    matches.forEach(scheme => {
      resultsGrid.appendChild(createSchemeCard(scheme, true));
    });
  }

  // Scroll to results
  document.getElementById('results-area').scrollIntoView({ behavior: 'smooth' });
});

// --- Modal Logic ---
const modal = document.getElementById('help-modal');
const modalForm = document.getElementById('help-form');
const successMessage = document.getElementById('help-success');
const closeModalBtn = document.getElementById('close-modal');

function openHelpModal(ngoId, ngoName) {
  document.getElementById('modal-ngo-name').innerText = ngoName;
  document.getElementById('help-ngo-id').value = ngoId;
  
  // Reset form
  modalForm.reset();
  modalForm.classList.remove('hidden');
  successMessage.classList.add('hidden');
  
  modal.classList.add('active');
}

closeModalBtn.addEventListener('click', () => {
  modal.classList.remove('active');
});

modalForm.addEventListener('submit', (e) => {
  e.preventDefault();
  // Simulate network request / API dispatch
  modalForm.classList.add('hidden');
  successMessage.classList.remove('hidden');
  
  setTimeout(() => {
    modal.classList.remove('active');
  }, 2500);
});

// Close modal on outside click
modal.addEventListener('click', (e) => {
  if(e.target === modal) {
    modal.classList.remove('active');
  }
});


// Initialization
renderAllSchemes();
renderNGOs();
renderStories();
