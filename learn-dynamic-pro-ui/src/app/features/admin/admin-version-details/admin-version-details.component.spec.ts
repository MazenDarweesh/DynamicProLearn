import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminVersionDetailsComponent } from './admin-version-details.component';

describe('AdminVersionDetailsComponent', () => {
  let component: AdminVersionDetailsComponent;
  let fixture: ComponentFixture<AdminVersionDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminVersionDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminVersionDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
