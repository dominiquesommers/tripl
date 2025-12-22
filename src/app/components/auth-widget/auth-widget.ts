import { Component, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth';
import { LucideAngularModule, LogOut } from 'lucide-angular';

@Component({
  selector: 'app-auth-widget',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './auth-widget.html',
  styleUrls: ['./auth-widget.css']
})
export class AuthWidget {
  showMenu = false;
  readonly LogOut = LogOut;

  constructor(public authService: AuthService, private eRef: ElementRef) {}

  async handleLogin() {
    this.showMenu = false;
    try {
      await this.authService.login();
    } catch (err) {
      console.error("Login failed", err);
    }
  }

  toggleMenu(event: MouseEvent) {
    event.stopPropagation();
    this.showMenu = !this.showMenu;
  }

  @HostListener('document:click', ['$event'])
  clickout(event: any) {
    // If the menu is open and we click outside, close it
    if (this.showMenu && !this.eRef.nativeElement.contains(event.target)) {
      this.showMenu = false;
    }
  }

  handleImageError(event: any, user: any) {
    const name = user.displayName || 'User';
    event.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4285F4&color=fff`;
  }
}
