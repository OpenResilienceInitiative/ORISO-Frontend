export const convertUserDataObjectToArray = (object) => {
	const array = [];
	Object.keys(object).forEach((key) => {
		let test = {
			type: key,
			value:
				object[key] && typeof object[key] === 'object'
					? convertUserDataObjectToArray(object[key])
					: object[key]
		};
		array.push(test);
	});
	return array;
};

export const getUserDataTranslateBase = (consultingType: number) => {
	return consultingType === 0 ? 'user.userAddiction' : 'user.userU25';
};

export const isUniqueLanguage = (value, index, self) => {
	return self.indexOf(value) === index;
};
