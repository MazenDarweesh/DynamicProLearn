import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { AdminService } from '../../../core/services/admin.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  ngOnInit() {
    // Note: We use static data here to perfectly match the UI alignment and design of the mockup
    // Once the UI alignment is approved, this will be connected to the admin.service.ts
  }

  editItem(type: string, oldName: string) {
    const newName = prompt(`تعديل اسم ${type}:`, oldName);
    if (!newName) return;
    alert(`تم تعديل ${type} إلى: ${newName}`);
    // In actual implementation, we call the adminService.update... methods
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  goTo(path: string) {
    this.router.navigate([`/${path}`]);
  }

  notImplemented(feature: string) {
    alert(`[UI Demo] The '${feature}' feature will be connected to the backend soon!`);
  }
}
