import React from "react";
import { View, TextInput, TouchableOpacity } from "react-native";
import { Send } from "../../../../assets/icons";
import colors from "../../../../styles/colors";
import { ROBOTO_FONTS } from "../../../../styles/fonts";
import { useStandardHeight } from "../../../../styles/spacing";

export default function TextInputContainer({
  sendMessage,
  setMessage,
  message,
}) {
  const vertical_40 = useStandardHeight(40);
  const textInput = () => {
    return (
      <View
        style={{
          height: vertical_40,
          marginBottom: 14,
          flexDirection: "row",
          borderRadius: 10,
          backgroundColor: colors.primary[600],
        }}
      >
        <View
          style={{
            flexDirection: "row",
            flex: 2,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <TextInput
            multiline
            value={message}
            placeholder={"Write your message"}
            style={{
              flex: 1,
              color: colors.primary[100],
              marginLeft: 12,
              fontFamily: ROBOTO_FONTS.RobotoMedium,
              margin: 4,
              padding: 4,
            }}
            numberOfLines={2}
            onChangeText={setMessage}
            autoCorrect
            spellCheck
            autoCapitalize="sentences"
            selectionColor={colors.purple}
            placeholderTextColor={colors.primary[400]}
          />
        </View>

        <View
          style={{
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: message.length > 0 ? colors.purple : "transparent",
            margin: 4,
            padding: 4,
            borderRadius: 8,
          }}
        >
          <TouchableOpacity
            onPress={sendMessage}
            style={{
              height: 30,
              aspectRatio: 1,
              justifyContent: "center",
              alignItems: "center",
              paddingVertical: 8,
              paddingVertical: 4,
            }}
          >
            <Send
              fill={message.length > 0 ? colors.onBrand : colors.primary[100]}
              width={20}
              height={20}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return <>{textInput()}</>;
}
