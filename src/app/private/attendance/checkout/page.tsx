'use client';
import { useAuthCheckout, useCameraCapture, useCheckoutFlow } from './hooks';
import {
  AuthStep,
  ReviewStep,
  CameraStep,
  PreviewStep,
  ConfirmStep,
  SuccessStep,
} from './components';

/**
 * Página de registro de salida de empleados
 * Flujo: Auth → Review → Camera → Preview → Confirm → Success
 */
export default function CheckOutPage() {
  const auth = useAuthCheckout();
  const camera = useCameraCapture();
  const flow = useCheckoutFlow();

  // Handlers para autenticación
  const handleAuthenticate = async () => {
    await auth.authenticate();
    if (auth.employee && auth.todayAttendance) {
      flow.setStep('review');
    }
  };

  // Handlers para step review
  const handleProceedToCamera = () => {
    flow.setStep('camera');
  };

  const handleBackToAuth = () => {
    flow.setStep('auth');
  };

  // Handlers para step camera
  const handleCaptureComplete = () => {
    flow.setStep('preview');
  };

  const handleCancelCamera = () => {
    camera.cleanup();
    flow.setStep('review');
  };

  // Handlers para step preview
  const handleProceedToConfirm = () => {
    flow.setStep('confirm');
  };

  const handleRetakePhoto = () => {
    camera.resetPhoto();
    flow.setStep('camera');
  };

  // Handlers para step confirm
  const handleConfirmCheckOut = async () => {
    await flow.confirmCheckOut(
      auth.employee,
      auth.todayAttendance,
      camera.photoBlob,
    );
  };

  const handleBackToReview = () => {
    flow.setStep('review');
  };

  // Handlers para step success
  const handleRegisterAnother = () => {
    camera.cleanup();
    auth.reset();
    flow.cleanup();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/10 to-danger/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Step: Autenticación */}
        {flow.step === 'auth' && (
          <AuthStep
            auth={auth}
            loading={auth.loading}
            onAuthenticate={handleAuthenticate}
          />
        )}

        {/* Step: Revisión */}
        {flow.step === 'review' && (
          <ReviewStep
            employee={auth.employee}
            todayAttendance={auth.todayAttendance}
            notes={flow.notes}
            onNotesChange={flow.setNotes}
            onContinue={handleProceedToCamera}
            onBack={handleBackToAuth}
          />
        )}

        {/* Step: Cámara */}
        {flow.step === 'camera' && (
          <CameraStep
            employee={auth.employee}
            camera={camera}
            loading={camera.loading}
            onCaptureComplete={handleCaptureComplete}
            onCancel={handleCancelCamera}
          />
        )}

        {/* Step: Preview */}
        {flow.step === 'preview' && (
          <PreviewStep
            employee={auth.employee}
            photoUrl={camera.photoUrl}
            loading={flow.loading}
            onContinue={handleProceedToConfirm}
            onRetry={handleRetakePhoto}
          />
        )}

        {/* Step: Confirmación */}
        {flow.step === 'confirm' && (
          <ConfirmStep
            employee={auth.employee}
            todayAttendance={auth.todayAttendance}
            loading={flow.loading}
            onConfirm={handleConfirmCheckOut}
            onBack={handleBackToReview}
          />
        )}

        {/* Step: Éxito */}
        {flow.step === 'success' && (
          <SuccessStep
            employee={auth.employee}
            todayAttendance={auth.todayAttendance}
            onRegisterAnother={handleRegisterAnother}
          />
        )}
      </div>
    </div>
  );
}
