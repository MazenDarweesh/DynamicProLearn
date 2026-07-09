import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminTestersComponent } from './admin-testers.component';

describe('AdminTestersComponent', () => {
  let component: AdminTestersComponent;
  let fixture: ComponentFixture<AdminTestersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminTestersComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminTestersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
