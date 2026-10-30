import type { PageId } from "@/hooks/useRoute";
import type { Compare, Review } from "@/lib/review";

export interface ReviewPageProps {
    review: Review;
    compare: Compare;
    go: (page: PageId) => void;
}
