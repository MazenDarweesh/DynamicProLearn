import { Component, EventEmitter, Input, Output, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProgressBarComponent } from '../progress-bar/progress-bar.component';
import { CurriculumViewerComponent } from '../curriculum-viewer/curriculum-viewer.component';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-evaluations-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ProgressBarComponent, CurriculumViewerComponent],
  templateUrl: './evaluations-dashboard.component.html',
  styleUrls: ['./evaluations-dashboard.component.css']
})
export class EvaluationsDashboardComponent implements OnChanges {
  @Input() isLoading = false;
  @Input() title = '';
  @Input() subtitle = '';
  @Input() name = '';
  @Input() completedLessons = 0;
  @Input() totalAssignedLessons = 0;
  
  @Input() filterOptions: string[] = [];
  @Input() filterType: 'version' | 'tester' = 'version'; // 'version' or 'tester'
  
  // Data array containing the versions/testers with their modules
  private _dataGroups: any[] = [];
  @Input() 
  set dataGroups(value: any[]) {
    this._dataGroups = value || [];
    this.applyFilters();
  }
  get dataGroups(): any[] {
    return this._dataGroups;
  }
  
  // Search state
  searchQuery = '';
  selectedFilterValue = '';
  isAllExpanded = false;

  filteredGroups: any[] = [];

  toggleExpandAll() {
    this.isAllExpanded = !this.isAllExpanded;
  }

  applyFilters() {
    const q = this.searchQuery.trim().toLowerCase();
    
    let groups = this.dataGroups;
    if (this.selectedFilterValue) {
      groups = groups.filter(g => g.groupName === this.selectedFilterValue);
    }

    if (!q) {
      this.filteredGroups = JSON.parse(JSON.stringify(groups));
      return;
    }

    const result = [];
    for (const g of groups) {
      const gCopy = { ...g, modules: [] };
      for (const m of g.modules) {
        const mCopy = { ...m, units: [] };
        for (const u of m.units) {
          const uCopy = { ...u, lessons: [] };
          for (const l of u.lessons) {
            const searchStr = (l.title || l.name || '').toLowerCase();
            const descStr = (l.description || l.comment || '').toLowerCase();
            if (searchStr.includes(q) || descStr.includes(q)) {
              uCopy.lessons.push(l);
            }
          }
          if (uCopy.lessons.length > 0) {
            mCopy.units.push(uCopy);
          }
        }
        if (mCopy.units.length > 0) {
          gCopy.modules.push(mCopy);
        }
      }
      if (gCopy.modules.length > 0) {
        result.push(gCopy);
      }
    }
    
    this.filteredGroups = result;
  }

  exportToExcel() {
    const rows: any[] = [];
    for (const g of this.filteredGroups) {
      for (const m of g.modules) {
        for (const u of m.units) {
          for (const l of u.lessons) {
            rows.push({
              [this.filterType === 'version' ? 'الإصدار' : 'المختبر']: g.groupName,
              'الموديول': m.name,
              'الوحدة': u.name,
              'الدرس': l.title || l.name,
              'حالة الدرس': l.status || 'غير مختبر',
              'التقييم/الملاحظات': l.comment || 'لا توجد ملاحظات',
              'تاريخ التقييم': l.evaluationDate ? new Date(l.evaluationDate).toLocaleDateString('ar-EG') : 'غير متوفر'
            });
          }
        }
      }
    }

    if (rows.length === 0) {
      alert('لا توجد بيانات للتصدير');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'التقييمات');
    XLSX.writeFile(wb, `${this.name}_التقييمات.xlsx`);
  }
}
