import { api } from "./api-client";

export type ReviewDTO = {
  id: string;
  rating: number;
  comment: string | null;
  status: string;
  clientName: string;
  employeeName: string;
  serviceName: string;
  createdAt: string;
};

export type ReviewsResponse = {
  total: number;
  averageRating: number;
  reviews: ReviewDTO[];
};

export async function getCompanyReviews() {
  return api<ReviewsResponse>("/api/reviews");
}

export async function submitReview(input: {
  appointmentId: string;
  rating: number;
  comment?: string | null;
}) {
  return api<{ id: string; rating: number; comment: string | null; status: string }>(
    "/api/reviews",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}
