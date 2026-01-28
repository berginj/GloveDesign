import { ORDER_URL } from "../../config";
import { CatalogDesign } from "../../data/seedCatalog";

interface CheckoutStepProps {
  design: CatalogDesign;
}

export function CheckoutStep({ design }: CheckoutStepProps) {
  return (
    <div className="step-layout">
      <div className="step-header">
        <h3>
          <span className="step-icon">▤</span>
          Checkout (Stub)
        </h3>
        <p>Collect shipping details and hand off the order.</p>
      </div>
      <div className="section-card">
        <div className="field-grid">
          <div>
            <label>Full Name</label>
            <input placeholder="Alex Rivera" />
          </div>
          <div>
            <label>Email</label>
            <input placeholder="alex@example.com" />
          </div>
          <div>
            <label>Shipping Address</label>
            <textarea placeholder="Street, City, State, ZIP" />
          </div>
        </div>
      </div>
      <div className="cta">
        <button>Place Order</button>
        <a className="button-link" href={ORDER_URL} target="_blank" rel="noreferrer">
          Continue at MyOrder
        </a>
      </div>
      <div className="summary">Order stub will send design: {design.id}</div>
    </div>
  );
}
