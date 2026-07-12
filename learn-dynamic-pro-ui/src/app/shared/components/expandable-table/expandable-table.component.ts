import { Component, ContentChild, Input, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-expandable-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <table class="data-table" [ngClass]="tableClass">
      <thead>
        <tr>
          <th width="50" *ngIf="expandable"></th>
          <ng-container *ngTemplateOutlet="headerTemplate"></ng-container>
        </tr>
      </thead>
      <tbody>
        <ng-container *ngFor="let item of data">
          <tr [class.expanded-bg]="isExpanded(item) && expandable">
            <td *ngIf="expandable">
              <button class="icon-btn" (click)="toggle(item)">
                <svg *ngIf="!isExpanded(item)" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                <svg *ngIf="isExpanded(item)" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
              </button>
            </td>
            <ng-container *ngTemplateOutlet="rowTemplate; context: { $implicit: item }"></ng-container>
          </tr>
          
          <tr *ngIf="isExpanded(item) && expandable" class="expanded-row">
            <td [attr.colspan]="colspan" class="p-0 border-0">
              <div class="sub-table-container" [ngStyle]="subTableContainerStyle">
                <ng-container *ngTemplateOutlet="expandedTemplate; context: { $implicit: item }"></ng-container>
              </div>
            </td>
          </tr>
        </ng-container>
        
        <tr *ngIf="!data || data.length === 0">
          <td [attr.colspan]="colspan" class="text-center text-secondary">{{ emptyMessage }}</td>
        </tr>
      </tbody>
    </table>
  `,
  styleUrls: ['./expandable-table.component.css']
})
export class ExpandableTableComponent {
  @Input() data: any[] = [];
  @Input() keyProp: string = 'id';
  @Input() colspan: number = 5;
  @Input() emptyMessage: string = 'لا توجد بيانات';
  @Input() tableClass: string = '';
  @Input() expandable: boolean = true;
  @Input() subTableContainerStyle: any = {};

  @ContentChild('header') headerTemplate!: TemplateRef<any>;
  @ContentChild('row') rowTemplate!: TemplateRef<any>;
  @ContentChild('expanded') expandedTemplate!: TemplateRef<any>;

  expandedItems: { [key: string]: boolean } = {};

  toggle(item: any) {
    if (!this.expandable) return;
    const key = item[this.keyProp];
    this.expandedItems[key] = !this.expandedItems[key];
  }

  isExpanded(item: any): boolean {
    if (!this.expandable) return false;
    return this.expandedItems[item[this.keyProp]] || false;
  }
}
