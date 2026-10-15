import { X } from "lucide-react";
export default function ModalClose({ close }: { close: () => void }) {
  return (
    <button
      className="modal-close icon-button"
      aria-label="Close dialog"
      onClick={close}
    >
      <X size={21} />
    </button>
  );
}
