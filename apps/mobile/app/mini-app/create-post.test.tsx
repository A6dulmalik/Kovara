import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import CreatePostScreen from "./create-post";
import { submitCreatePost } from "./submitCreatePost";
import { resolvePendingRequest } from "../../mini-apps/bridge";

// A `jest.mock()` factory is hoisted above these declarations, so it may only
// reference variables whose names begin with `mock` — Jest rejects anything
// else to guard against reading an uninitialised binding.
const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ requestId: "req-1" }),
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace }),
}));

jest.mock("../../mini-apps/bridge", () => ({
  resolvePendingRequest: jest.fn(),
}));

jest.mock("./submitCreatePost", () => ({
  submitCreatePost: jest.fn(),
}));

describe("CreatePostScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps the compose view active when submission fails", async () => {
    (submitCreatePost as jest.Mock).mockRejectedValueOnce(new Error("boom"));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    const { getByPlaceholderText, getByText } = render(<CreatePostScreen />);

    fireEvent.changeText(getByPlaceholderText("What's on your mind?"), "Hello world");
    fireEvent.press(getByText("Post"));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());

    expect(mockBack).not.toHaveBeenCalled();
    expect(resolvePendingRequest).not.toHaveBeenCalled();
    expect(getByPlaceholderText("What's on your mind?").props.value).toBe("Hello world");
    expect(getByText("Post")).toBeTruthy();
  });
});
