import React from "react";
import { render } from "@testing-library/react-native";

import ProfileHeader from "../ProfileHeader";

describe("ProfileHeader", () => {
  it("renders a banner image when a banner URL is provided", () => {
    const { getByTestId } = render(
      <ProfileHeader
        profile={{
          address: "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
          username: "alice",
          bannerUrl: "https://example.com/banner.jpg",
        }}
        followerCount={12}
        followingCount={4}
        isFollowing={false}
        onFollowersPress={() => undefined}
        onFollowingPress={() => undefined}
        onEditPress={() => undefined}
        onToggleFollow={() => undefined}
      />
    );

    expect(getByTestId("profile-banner-image")).toBeTruthy();
  });
});
