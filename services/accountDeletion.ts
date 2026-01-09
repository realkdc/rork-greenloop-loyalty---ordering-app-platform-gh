import { db } from "@/app/lib/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";

export async function submitAccountDeletionRequest(email: string): Promise<void> {
  try {
    const deletionRef = collection(db, "accountDeletionRequests");
    await addDoc(deletionRef, {
      email: email.trim(),
      requestedAt: Timestamp.now(),
      status: "pending",
    });

    console.log(`[Account Deletion] Request submitted for: ${email}`);
  } catch (error) {
    console.error("[Account Deletion] Error:", error);
    throw new Error("Failed to submit deletion request. Please try again.");
  }
}
