gsap.registerPlugin(Flip)

gsap.defaults({
  ease: "power4.inOut",
  duration: 0.8,
});


function createLightbox(container, {
  onStart,
  onOpen,
  onClose,
  onCloseComplete
} = {}) {
  
    const elements = {
      wrapper: container.querySelector('[data-lightbox="wrapper"]'),
      triggers: container.querySelectorAll('[data-lightbox="trigger"]'),
      triggerParents: container.querySelectorAll('[data-lightbox="trigger-parent"]'),
      items: container.querySelectorAll('[data-lightbox="item"]'),
      nav: container.querySelectorAll('[data-lightbox="nav"]'),
      counter: {
        current: container.querySelector('[data-lightbox="counter-current"]'),
        total: container.querySelector('[data-lightbox="counter-total"]')
      },
      buttons: {
        prev: container.querySelector('[data-lightbox="prev"]'),
        next: container.querySelector('[data-lightbox="next"]'),
        close: container.querySelector('[data-lightbox="close"]')
      }
    };

    // Create our main timeline that will coordinate all animations
    const mainTimeline = gsap.timeline();


    // ————————— COUNTER ————————— //
    if (elements.counter.total) {
      elements.counter.total.textContent = elements.triggers.length;
    }
    
    
    // ————————— CLOSE FUNCTION ————————— //
    function closeLightbox() {
      // on close callback
      onClose?.();
      
      // First, we clear any running animations to prevent conflicts
      mainTimeline.clear();
      gsap.killTweensOf([
        elements.wrapper, 
        elements.nav, 
        elements.triggerParents, 
        elements.items,
        container.querySelector('[data-lightbox="original"]')
      ]);
      
      const tl = gsap.timeline({
        defaults: { ease: "power2.inOut" },
        onComplete: () => {
          elements.wrapper.classList.remove('is-active');
          
          // Show all hidden images in lightbox items
          elements.items.forEach(item => {
            item.classList.remove('is-active');
            const lightboxImage = item.querySelector('img');
            if (lightboxImage) {
              lightboxImage.style.display = '';
            }
          });
          
          // Clear any lingering transform properties on the original image
          const originalImg = container.querySelector('[data-lightbox="original"]');
          if (originalImg) { gsap.set(originalImg, { clearProps: "all" });}
          
          // Remove the fixed height from the trigger parent
          const originalParent = container.querySelector('[data-lightbox="original-parent"]');
          if (originalParent) { originalParent.parentElement.style.removeProperty('height'); }
          
          // on close complete callback
          onCloseComplete?.();
        }
      });
  
      // First, find and move back the original item
      const originalItem = container.querySelector('[data-lightbox="original"]');
      const originalParent = container.querySelector('[data-lightbox="original-parent"]');
      
      if (originalItem && originalParent) {
        // Before moving the item back, clear its transforms
        gsap.set(originalItem, { clearProps: "all" });
        // Move the item back to its original parent
        originalParent.appendChild(originalItem);
        originalParent.removeAttribute('data-lightbox');
        originalItem.removeAttribute('data-lightbox');
      }
      
      // Find active slide
      let activeLightboxSlide = container.querySelector('[data-lightbox="item"].is-active')

      // Return animation
      tl.to(elements.triggerParents, {
        autoAlpha: 1,
        duration: 0.5,
        stagger: 0.03,
        overwrite: true
      })
      .to(elements.nav, {
        autoAlpha: 0,
        y: "1rem",
        duration: 0.4,
        stagger: 0
      },"<")
      .to(elements.wrapper, {
        backgroundColor: "rgba(0,0,0,0)",
        duration: 0.4
      }, "<")
      .to(activeLightboxSlide,{
        autoAlpha:0,
        duration: 0.4,
      },"<")
      .set([elements.items, activeLightboxSlide, elements.triggerParents],  { clearProps: "all" })
    
      // Add this timeline to our main timeline
      mainTimeline.add(tl);
      
    }


    // ————————— CLICK-OUTSIDE FUNCTIONALITY ————————— //
    function handleOutsideClick(event) {
      if (event.detail === 0) {
        return;
      }
    
      const clickedElement = event.target;
      const isOutside = !clickedElement.closest('[data-lightbox="item"].is-active img, [data-lightbox="nav"], [data-lightbox="close"], [data-lightbox="trigger"]');
        
      if (isOutside) {
        closeLightbox();
      }
    }


    // ————————— TOGGLE ACTIVE ITEM IN LIGHTBOX ————————— //
    function updateActiveItem(index) {
      elements.items.forEach(item => item.classList.remove('is-active'));
      elements.items[index].classList.add('is-active');
        
      if (elements.counter.current) {
        elements.counter.current.textContent = index + 1;
      }
    }


    // ————————— CLICK TO OPEN ————————— //
    elements.triggers.forEach((trigger, index) => {
      trigger.addEventListener('click', () => {
        // On start of open callback
        onStart?.();
        
        // Clear any running animations before starting new ones
        mainTimeline.clear();
        gsap.killTweensOf([
          elements.wrapper, 
          elements.nav, 
          elements.triggerParents
        ]);
        
        const img = trigger.querySelector("img")
        const state = Flip.getState(img);
        
        // Store the trigger's current height before the FLIP animation
        // So the grid does not collapse
        const triggerRect = trigger.getBoundingClientRect();
        trigger.parentElement.style.height = `${triggerRect.height}px`;
        
      
        // Save element and parent that was clicked
        trigger.setAttribute('data-lightbox', 'original-parent');
        img.setAttribute('data-lightbox', 'original');
        
        
        // Set correct lightbox item to visible
        updateActiveItem(index);
        
        
        // Start listening for clicks outside of lightbox
        container.addEventListener('click', handleOutsideClick);
        
        const tl = gsap.timeline({
          onComplete: () => {
            // On open callback
            onOpen?.();
          }
        });
        elements.wrapper.classList.add('is-active');
        const targetItem = elements.items[index];
        
        // Hide the original image in the lightbox item
        const lightboxImage = targetItem.querySelector('img');
        if (lightboxImage) {
          lightboxImage.style.display = 'none';
        }
  
        // Fade out other grid items
        elements.triggerParents.forEach(otherTrigger => {
          if (otherTrigger !== trigger) {
            gsap.to(otherTrigger, {
              autoAlpha: 0,
              duration: 0.4,
              stagger:0.02,
              overwrite: true
            });
          }
        });
  
        // Flip clicked image into lightbox
        if (!targetItem.contains(img)) {
          targetItem.appendChild(img);
          tl.add(
            Flip.from(state, {
              targets: img,
              absolute: true,
              duration: 0.6,
              ease: "power2.inOut"
            }), 0
          );
        }
        
        // Animate in our navigation and background
        tl.to(elements.wrapper, {
          backgroundColor: "rgba(0,0,0,0.75)",
          duration: 0.6
        }, 0)
        .fromTo(elements.nav, {
          autoAlpha: 0,
          y: "1rem"
        }, {
          autoAlpha: 1,
          y: "0rem",
          duration: 0.6,
          stagger: { each: 0.05, from: "center" }
        }, 0.2);
        
        // Add this timeline to our main timeline
        mainTimeline.add(tl);
        
      });
    });


    // ————————— NAV BUTTONS ————————— //
    if (elements.buttons.next) {
      elements.buttons.next.addEventListener('click', () => {
        const currentIndex = Array.from(elements.items).findIndex(item => 
          item.classList.contains('is-active')
        );
        const nextIndex = (currentIndex + 1) % elements.items.length;
        updateActiveItem(nextIndex);
      });
    }

    if (elements.buttons.prev) {
      elements.buttons.prev.addEventListener('click', () => {
        const currentIndex = Array.from(elements.items).findIndex(item => 
          item.classList.contains('is-active')
      );
      const prevIndex = (currentIndex - 1 + elements.items.length) % elements.items.length;
        updateActiveItem(prevIndex);
      });
    }

    if (elements.buttons.close) {
      elements.buttons.close.addEventListener('click', closeLightbox);
    }


    // ————————— KEYBOARD NAV ————————— //
    document.addEventListener('keydown', (event) => {
      if (!elements.wrapper.classList.contains('is-active')) return;
      switch (event.key) {
        case 'Escape':
          closeLightbox();
          break;
        case 'ArrowRight':
          elements.buttons.next?.click();
          break;
        case 'ArrowLeft':
          elements.buttons.prev?.click();
          break;
      }
    });
}

document.addEventListener("DOMContentLoaded", () =>{
  let wrappers = document.querySelectorAll("[data-gallery]")
  wrappers.forEach((wrapper) => {
    
    // SIMPLE INIT
    createLightbox(wrapper)
    
    //	SUPPORTED CALLBACKS:
    //  createLightbox(wrapper, {
    //    onStart: () => console.log("Starting"),
    //    onOpen: () => console.log("Open"),
    //    onClose: () => console.log("Closing"),
    //    onCloseComplete: () => console.log("Done")
    //  });    
  });
})
