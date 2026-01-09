import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";
import { db } from "@/app/lib/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";

export default publicProcedure
  .input(
    z.object({
      email: z.string().email("Please enter a valid email address"),
    })
  )
  .mutation(async ({ input }) => {
    try {
      // Store the deletion request in Firestore
      const deletionRef = collection(db, "accountDeletionRequests");
      await addDoc(deletionRef, {
        email: input.email,
        requestedAt: Timestamp.now(),
        status: "pending",
      });

      // Log for monitoring
      console.log(`[Account Deletion] Request submitted for: ${input.email}`);

      return {
        success: true,
        message: "Account deletion request submitted successfully",
      };
    } catch (error) {
      console.error("[Account Deletion] Error:", error);
      throw new Error("Failed to submit deletion request. Please try again.");
    }
  });
