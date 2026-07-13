import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminModuleDto } from '../../../../../core/models/admin.models';

@Component({
  selector: 'app-module-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './module-editor.component.html',
  styleUrls: ['./module-editor.component.css']
})
export class ModuleEditorComponent {
  @Input() module!: AdminModuleDto;
}
