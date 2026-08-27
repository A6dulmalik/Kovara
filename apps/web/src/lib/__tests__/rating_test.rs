#[cfg(test)]
mod rating_tests {
    use crate::rating::{SLARating, SLARatingClassifier};
    use soroban_sdk::symbol_short;

    #[test]
    fn test_sla_rating_boundaries() {
        assert_eq!(SLARatingClassifier::classify_sla(100), SLARating::Top);
        assert_eq!(SLARatingClassifier::classify_sla(99), SLARating::Top);
        assert_eq!(SLARatingClassifier::classify_sla(98), SLARating::Excel);
        assert_eq!(SLARatingClassifier::classify_sla(95), SLARating::Excel);
        assert_eq!(SLARatingClassifier::classify_sla(94), SLARating::Good);
        assert_eq!(SLARatingClassifier::classify_sla(90), SLARating::Good);
        assert_eq!(SLARatingClassifier::classify_sla(89), SLARating::Viol);
        assert_eq!(SLARatingClassifier::classify_sla(0), SLARating::Viol);
    }

    #[test]
    fn test_rating_symbol_encodings() {
        assert_eq!(SLARatingClassifier::to_symbol(&SLARating::Top), symbol_short!("top"));
        assert_eq!(SLARatingClassifier::to_symbol(&SLARating::Excel), symbol_short!("excel"));
        assert_eq!(SLARatingClassifier::to_symbol(&SLARating::Good), symbol_short!("good"));
        assert_eq!(SLARatingClassifier::to_symbol(&SLARating::Viol), symbol_short!("viol"));
    }
}