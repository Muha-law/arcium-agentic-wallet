use arcis::*;

#[encrypted]
mod circuits {
    use arcis::*;

    /// Signs a transaction message using the MXE's distributed Ed25519 key.
    /// The private key never exists in a single location — each MPC node holds
    /// a share and they collectively produce a valid Ed25519 signature.
    #[instruction]
    pub fn sign_transaction(message: [u8; 32]) -> ArcisEd25519Signature {
        let signature = MXESigningKey::sign(&message);
        signature.reveal()
    }

    /// Verifies an Ed25519 signature against an encrypted verifying key.
    /// The public key remains confidential throughout verification.
    #[instruction]
    pub fn verify_agent_signature(
        verifying_key_enc: Enc<Shared, Pack<VerifyingKey>>,
        message: [u8; 32],
        signature: [u8; 64],
        observer: Shared,
    ) -> Enc<Shared, bool> {
        let verifying_key = verifying_key_enc.to_arcis().unpack();
        let signature = ArcisEd25519Signature::from_bytes(signature);
        let is_valid = verifying_key.verify(&message, &signature);
        observer.from_arcis(is_valid)
    }
}
