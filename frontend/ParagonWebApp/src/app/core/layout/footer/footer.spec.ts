import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Footer } from './footer';

// ===== Footer Component Tests =====
describe('Footer', () => {
  // Component and fixture used across tests
  let component: Footer;
  let fixture: ComponentFixture<Footer>;

  // Configure and compile the test module before each spec
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Footer]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Footer);
    component = fixture.componentInstance;

    // Wait for any async lifecycle work to settle before assertions
    await fixture.whenStable();
  });

  // Basic smoke test: the component should instantiate
  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
