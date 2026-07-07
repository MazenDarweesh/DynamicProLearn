import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private router = inject(Router);

  username = '';
  password = '';
  errorMessage = '';
  isLoading = false;

  onSubmit() {
    this.errorMessage = '';
    this.isLoading = true;
    
    this.http.post<{token: string}>('http://localhost:5115/api/Auth/login', {
      username: this.username,
      password: this.password
    }).subscribe({
      next: (res) => {
        this.auth.login(res.token);
        this.isLoading = false;
        
        const role = this.auth.userRole();
        if (role === 'Admin') this.router.navigate(['/admin']);
        else if (role === 'Student') this.router.navigate(['/student']);
        else if (role === 'Tester') this.router.navigate(['/tester']);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.detail || 'Invalid username or password';
      }
    });
  }
}
