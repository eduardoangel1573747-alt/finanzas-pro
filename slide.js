 function toggleSidebar() {
           const sidebar = document.getElementById('sidebar');
           const backdrop = document.getElementById('sidebarBackdrop');
           
           const isOpen = !sidebar.classList.contains('-translate-x-full');
           
           if (isOpen) {
               // Cerrar panel
               sidebar.classList.add('-translate-x-full');
               backdrop.classList.add('opacity-0');
               setTimeout(() => backdrop.classList.add('hidden'), 300);
           } else {
               // Abrir panel
               backdrop.classList.remove('hidden');
               setTimeout(() => backdrop.classList.remove('opacity-0'), 10);
               sidebar.classList.remove('-translate-x-full');
           }
       }