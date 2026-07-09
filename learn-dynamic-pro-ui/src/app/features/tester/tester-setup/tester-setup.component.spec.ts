import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TesterSetupComponent } from './tester-setup.component';

describe('TesterSetupComponent', () => {
  let component: TesterSetupComponent;
  let fixture: ComponentFixture<TesterSetupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TesterSetupComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TesterSetupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
