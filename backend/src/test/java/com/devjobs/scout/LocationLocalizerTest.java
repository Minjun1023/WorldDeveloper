package com.devjobs.scout;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class LocationLocalizerTest {

    @Test
    void localizesJapaneseAddressToCityAndCountry() {
        assertThat(LocationLocalizer.localize("東京都中央区")).isEqualTo("도쿄, 일본");
        // 우편번호 + 전체 주소 + 빌딩명도 도시·국가로 축약.
        assertThat(LocationLocalizer.localize("106-6113 東京都港区六本木6-10-1 六本木ヒルズ森タワー13F"))
            .isEqualTo("도쿄, 일본");
        assertThat(LocationLocalizer.localize("大阪府大阪市北区")).isEqualTo("오사카, 일본");
    }

    @Test
    void prefersCityOverPrefectureAndTokyoOverKyoto() {
        // "東京都"는 "京都"를 포함 — 東京 을 먼저 검사해 도쿄로.
        assertThat(LocationLocalizer.localize("東京都渋谷区")).isEqualTo("도쿄, 일본");
        // 神奈川県横浜市 — 도시(横浜)를 도도부현보다 우선.
        assertThat(LocationLocalizer.localize("神奈川県横浜市西区")).isEqualTo("요코하마, 일본");
    }

    @Test
    void unknownJapaneseLocationFallsBackToCountry() {
        // 가나/한자는 있으나 등록 도시 미상 → 최소 국가.
        assertThat(LocationLocalizer.localize("沖縄県那覇市")).isEqualTo("오키나와, 일본");
        assertThat(LocationLocalizer.localize("青森県")).isEqualTo("일본");
    }

    @Test
    void localizesEnglishJapaneseCities() {
        assertThat(LocationLocalizer.localize("Tokyo, Japan")).isEqualTo("도쿄, 일본");
        assertThat(LocationLocalizer.localize("Tokyo")).isEqualTo("도쿄, 일본");
        assertThat(LocationLocalizer.localize("Japan")).isEqualTo("일본");
    }

    @Test
    void returnsNullForNonJapaneseLocations() {
        // 로컬라이즈 대상 아님 → null(호출부가 원본 표시).
        assertThat(LocationLocalizer.localize("Berlin, Germany")).isNull();
        assertThat(LocationLocalizer.localize("Singapore")).isNull();
        assertThat(LocationLocalizer.localize("Remote")).isNull();
        assertThat(LocationLocalizer.localize("")).isNull();
        assertThat(LocationLocalizer.localize(null)).isNull();
    }
}
