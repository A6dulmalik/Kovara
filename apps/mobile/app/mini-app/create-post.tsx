import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { resolvePendingRequest } from "../../mini-apps/bridge";
import { submitCreatePost } from "./submitCreatePost";

export default function CreatePostScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      Alert.alert("Empty post", "Write something before posting.");
      return;
    }

    setSubmitting(true);

    try {
      const postId = await submitCreatePost(trimmed);

      if (requestId) {
        resolvePendingRequest(requestId, { postId, content: trimmed });
      }

      router.back();
    } catch {
      // Stay on the compose screen with the draft intact. Navigating away or
      // clearing the field would discard what the user wrote because of a
      // failure that had nothing to do with them.
      Alert.alert("Post failed", "Something went wrong. Your draft has been kept.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.form}>
        <Text style={styles.heading}>Create Post</Text>
        <TextInput
          style={styles.input}
          placeholder="What's on your mind?"
          placeholderTextColor="#64748b"
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
          autoFocus
          editable={!submitting}
        />
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  form: {
    flex: 1,
    padding: 16,
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f1f5f9",
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#334155",
    minHeight: 160,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: "#6366f1",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
