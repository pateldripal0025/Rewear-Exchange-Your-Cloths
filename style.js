document.addEventListener('DOMContentLoaded', () => {
    // Wishlist AJAX toggle handler
    const wishlistForms = document.querySelectorAll('form[action$="/wishlist"]');
    
    wishlistForms.forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const url = form.getAttribute('action');
            const heartIcon = form.querySelector('i.bi-heart, i.bi-heart-fill');
            const wishlistItem = form.closest('.wishlist-item');
            
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });
                
                if (response.status === 401 || response.url.includes('/login')) {
                    window.location.href = '/login';
                    return;
                }

                if (!response.ok) throw new Error('Network response was not ok');
                
                const data = await response.json();
                
                if (data.success) {
                    // Update heart icon if present
                    if (heartIcon) {
                        if (data.inWishlist) {
                            heartIcon.classList.remove('bi-heart');
                            heartIcon.classList.add('bi-heart-fill', 'text-danger');
                        } else {
                            heartIcon.classList.remove('bi-heart-fill', 'text-danger');
                            heartIcon.classList.add('bi-heart');
                        }
                    }
                    
                    // Remove item from UI if removed from wishlist on dashboard
                    if (wishlistItem && !data.inWishlist) {
                        wishlistItem.parentElement.remove();
                        
                        const wishlistContainer = document.querySelector('#wishlist .row');
                        if (wishlistContainer && wishlistContainer.children.length === 0) {
                            document.querySelector('#wishlist .rw-form-card').innerHTML = `
                                <div class="text-center py-5">
                                    <i class="bi bi-heart text-muted fs-1 mb-2 d-block"></i>
                                    <h5 class="font-serif text-white">Your Saved Wishlist is Empty</h5>
                                    <p class="text-muted small">Click the heart icon on any listing to bookmark pieces here.</p>
                                    <a href="/listings" class="rw-btn rw-btn-accent rw-btn-sm mt-2">Browse Archive</a>
                                </div>
                            `;
                        }
                    }
                }
            } catch (error) {
                console.error('Error toggling wishlist:', error);
                form.submit();
            }
        });
    });

    // Navbar scroll effect
    const mainNav = document.getElementById('main-nav');
    if (mainNav) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 40) {
                mainNav.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
            } else {
                mainNav.style.boxShadow = 'none';
            }
        });
    }
});